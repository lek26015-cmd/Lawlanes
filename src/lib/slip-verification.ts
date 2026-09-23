import 'server-only';
import * as admin from 'firebase-admin';

/**
 * แลกตั๋วผลตรวจสลิปเป็นคำตอบว่า "จ่ายจริงหรือยัง" — ใช้ครั้งเดียวต่อใบ
 *
 * ของเดิมทุก action รับ `slipOkData` มาจากเบราว์เซอร์ตรงๆ แล้วใช้ `!!slipOkData`
 * เป็นเกณฑ์ตั้ง status เป็น 'paid'/'active' → เปิด console ยิง action พร้อม
 * `slipOkData: {}` ก็ได้สถานะจ่ายแล้วฟรี ทั้งที่ไม่เคยโอนเงิน
 *
 * ตอนนี้ client ถือได้แค่ `verificationId` ที่ /api/verify-slip ออกให้หลัง SlipOK
 * ตอบผ่านจริง ตัวนี้จึงไปอ่านเอกสารนั้นเอง แล้วตรวจ 3 อย่าง:
 *   1. เป็นของผู้เรียกคนนี้จริง
 *   2. ยังไม่ถูกใช้ (กันสลิปใบเดียวจ่ายหลายรายการ)
 *   3. ยอดในสลิปตรงกับยอดที่ server คิดได้
 * ผ่านครบ → ทำเครื่องหมายว่าใช้แล้วแล้วคืน verified: true
 *
 * ไม่ผ่าน = ไม่ error แต่คืน verified: false → รายการไปรอแอดมินตรวจสลิปแทน
 * (พฤติกรรมเดียวกับตอนสลิปไม่มี QR ซึ่งเป็นเส้นทางปกติอยู่แล้ว)
 */
export async function consumeSlipVerification(
    db: FirebaseFirestore.Firestore,
    uid: string,
    verificationId: string | null | undefined,
    expectedAmount: number
): Promise<{ verified: boolean; slipData: unknown | null }> {
    if (!verificationId) return { verified: false, slipData: null };

    const ref = db.collection('slipVerifications').doc(verificationId);

    try {
        return await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) return { verified: false, slipData: null };

            const v = snap.data()!;
            if (v.uid !== uid) return { verified: false, slipData: null };
            if (v.consumed === true) return { verified: false, slipData: null };

            const slipAmount = Number(v.amount) || 0;
            if (Math.abs(slipAmount - expectedAmount) > 0.01) {
                return { verified: false, slipData: null };
            }

            tx.update(ref, {
                consumed: true,
                consumedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { verified: true, slipData: v.slipData ?? null };
        });
    } catch (e) {
        console.error('consumeSlipVerification failed:', e);
        return { verified: false, slipData: null };
    }
}
