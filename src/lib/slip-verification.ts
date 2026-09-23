import 'server-only';
import * as admin from 'firebase-admin';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

/**
 * แลกตั๋วผลตรวจสลิปเป็นคำตอบว่า "จ่ายจริงหรือยัง" — ใช้ครั้งเดียวต่อสลิป
 *
 * ของเดิมทุก action รับ `slipOkData` มาจากเบราว์เซอร์ตรงๆ แล้วใช้ `!!slipOkData`
 * เป็นเกณฑ์ตั้ง status เป็น 'paid'/'active' → เปิด console ยิง action พร้อม
 * `slipOkData: {}` ก็ได้สถานะจ่ายแล้วฟรี ทั้งที่ไม่เคยโอนเงิน
 *
 * ตอนนี้ client ถือได้แค่ `verificationId` ที่ /api/verify-slip ออกให้หลัง SlipOK
 * ตอบผ่านจริง ตัวนี้จึงไปอ่านเอกสารนั้นเอง แล้วตรวจ:
 *   1. เป็นของผู้เรียกคนนี้จริง
 *   2. ตั๋วใบนี้ยังไม่ถูกใช้
 *   3. **สลิปใบนี้ (transRef) ยังไม่เคยถูกใช้** — ตั๋วเป็นแค่ "ผลตรวจหนึ่งครั้ง"
 *      สแกนสลิปใบเดิมซ้ำก็ได้ตั๋วใบใหม่ทุกครั้ง ถ้ากันแค่ระดับตั๋ว สลิปโอนจริงใบเดียว
 *      จะแลกเป็นห้องแชท/นัดหมาย "จ่ายแล้ว" ได้ไม่จำกัด (ด่านใน /api/verify-slip
 *      เป็นแค่ UX เพราะเช็คก่อนออกตั๋ว ยิงพร้อมกันหลายใบก็ผ่านทุกใบ)
 *      จึงจอง `slipTransRefs/{transRef}` ใน transaction เดียวกับการใช้ตั๋ว
 *   4. ยอดในสลิปตรงกับยอดที่ server คิดได้
 *
 * สลิปที่ไม่มี transRef = ยืนยันไม่ได้ว่าเป็นใบไหน → ไม่ผ่านอัตโนมัติ ไปรอแอดมินตรวจ
 *
 * ไม่ผ่าน = ไม่ error แต่คืน verified: false → รายการไปรอแอดมินตรวจสลิปแทน
 * (พฤติกรรมเดียวกับตอนสลิปไม่มี QR ซึ่งเป็นเส้นทางปกติอยู่แล้ว)
 *
 * ⚠️ ต้องเรียกภายใน transaction เดียวกับการเขียนรายการชำระเงิน และเรียก
 *    `commit()` ที่คืนไปก่อน/พร้อมกับ tx.set() ของรายการนั้น — ไม่งั้นตั๋วถูกใช้
 *    ไปแล้วแต่รายการเขียนไม่สำเร็จ ลูกค้าเสียสลิปฟรี หรือกลับกันคือรายการเขียนแล้ว
 *    แต่สลิปยังไม่ถูกจอง เอาไปใช้ซ้ำได้อีก
 *    และเพราะ Firestore transaction ต้องอ่านให้ครบก่อนเขียน ฟังก์ชันนี้จึงแยก
 *    "อ่าน/ตัดสิน" (ตอนเรียก) ออกจาก "เขียน" (commit) ให้ผู้เรียกอ่านอย่างอื่น
 *    (เช่น redeemCouponInTx) ต่อได้ก่อนลงมือเขียน
 */

export type SlipOutcome = {
    verified: boolean;
    slipData: unknown | null;
    /** จองสลิปและทำเครื่องหมายตั๋วว่าใช้แล้ว — ไม่ทำอะไรถ้า verified: false */
    commit: () => void;
};

const NOT_VERIFIED: SlipOutcome = { verified: false, slipData: null, commit: () => {} };

/**
 * แปลง transRef เป็น document id ที่ใช้ได้แน่นอน
 * (id ห้ามมี '/', ห้ามเป็น '.' หรือ '..', ห้ามขึ้นต้นและลงท้ายด้วย '__')
 * คืน null ถ้าว่างหรือยาวผิดปกติ — ถือว่าไม่มี transRef
 */
export function slipTransRefDocId(transRef: unknown): string | null {
    if (typeof transRef !== 'string') return null;
    const t = transRef.trim();
    if (!t || t.length > 200) return null;
    return `tr_${encodeURIComponent(t)}`;
}

export async function readSlipVerificationInTx(
    tx: Transaction,
    db: Firestore,
    uid: string,
    verificationId: string | null | undefined,
    expectedAmount: number
): Promise<SlipOutcome> {
    if (!verificationId) return NOT_VERIFIED;

    const ref = db.collection('slipVerifications').doc(verificationId);
    const snap = await tx.get(ref);
    if (!snap.exists) return NOT_VERIFIED;

    const v = snap.data()!;
    if (v.uid !== uid) return NOT_VERIFIED;
    if (v.consumed === true) return NOT_VERIFIED;

    const slipAmount = Number(v.amount) || 0;
    if (Math.abs(slipAmount - expectedAmount) > 0.01) return NOT_VERIFIED;

    const transRef = typeof v.transRef === 'string' ? v.transRef.trim() : '';
    const transRefId = slipTransRefDocId(transRef);
    if (!transRefId) return NOT_VERIFIED;

    const transRefRef = db.collection('slipTransRefs').doc(transRefId);
    const [transRefSnap, legacyDup] = await Promise.all([
        tx.get(transRefRef),
        // ตั๋วที่ถูกใช้ก่อนมี slipTransRefs ไม่มีเอกสารจองให้เช็ค — ไล่หาจากตั๋วเก่าด้วย
        tx.get(
            db.collection('slipVerifications')
                .where('transRef', '==', transRef)
                .where('consumed', '==', true)
                .limit(1)
        ),
    ]);
    if (transRefSnap.exists || !legacyDup.empty) return NOT_VERIFIED;

    return {
        verified: true,
        slipData: v.slipData ?? null,
        commit: () => {
            const now = admin.firestore.FieldValue.serverTimestamp();
            // create ไม่ใช่ set — ถ้ามีใครจองตัดหน้าระหว่างทาง ทั้ง transaction ต้องล้ม
            tx.create(transRefRef, {
                transRef,
                verificationId,
                uid,
                amount: slipAmount,
                consumedAt: now,
            });
            tx.update(ref, { consumed: true, consumedAt: now });
        },
    };
}
