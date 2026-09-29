import 'server-only';

import type { AiCreditStatus } from '@/lib/lawyer-entitlements';

/**
 * เครดิต AI ของทนาย — สองกระเป๋า
 *   - รายเดือน: ตามสิทธิ์แพลน (aiCreditsPerMonth) รีเซ็ตต้นเดือนปฏิทินเวลาไทย
 *   - extra: เครดิตที่ซื้อ/ได้เพิ่ม ไม่หมดอายุรายเดือน — หักหลังรายเดือนหมด
 *     (ยังไม่มีระบบซื้อ: การเติมในอนาคตให้บวก `extra` ใน transaction และเขียน ledger reason 'purchase')
 *
 * `lawyerAiCredits/{uid}`     { period: 'YYYY-MM', monthlyUsed, extra, updatedAt }
 * `lawyerAiCreditLedger/{id}` { uid, delta, fromMonthly, fromExtra, reason, period, meta, at } — ทุกการหัก/คืน/เติม
 * ทั้งสองคอลเลกชันเขียนผ่าน Admin SDK เท่านั้น (ไม่มี rules = client อ่าน/เขียนไม่ได้)
 */

type Db = FirebaseFirestore.Firestore;

export type CreditCharge = { period: string; fromMonthly: number; fromExtra: number };

/** เดือนปฏิทินตามเวลาไทย */
export function creditPeriod(now = Date.now()) {
    return new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

function status(period: string, monthly: number | null, monthlyUsed: number, extra: number): AiCreditStatus {
    return {
        period,
        monthly,
        monthlyUsed,
        extra,
        remaining: monthly === null ? null : Math.max(0, monthly - monthlyUsed) + extra,
    };
}

function read(snap: FirebaseFirestore.DocumentSnapshot, period: string) {
    const samePeriod = snap.get('period') === period;
    return {
        monthlyUsed: samePeriod ? Math.max(0, Number(snap.get('monthlyUsed')) || 0) : 0,
        extra: Math.max(0, Number(snap.get('extra')) || 0),
    };
}

export async function getCreditStatus(db: Db, uid: string, monthly: number | null): Promise<AiCreditStatus> {
    const period = creditPeriod();
    const snap = await db.collection('lawyerAiCredits').doc(uid).get();
    const { monthlyUsed, extra } = read(snap, period);
    return status(period, monthly, monthlyUsed, extra);
}

/** หักเครดิตก่อนเรียก AI — ไม่พอคืน ok:false (ไม่หักอะไร) · monthly null = ไม่จำกัด แต่ยังนับยอดใช้ไว้ดู */
export async function consumeCredits(
    db: Db, uid: string, monthly: number | null, cost: number, reason: string, meta: Record<string, unknown> = {},
): Promise<{ ok: true; charge: CreditCharge; status: AiCreditStatus } | { ok: false; status: AiCreditStatus }> {
    const period = creditPeriod();
    const ref = db.collection('lawyerAiCredits').doc(uid);
    return db.runTransaction(async tx => {
        const { monthlyUsed, extra } = read(await tx.get(ref), period);
        let fromMonthly = cost;
        let fromExtra = 0;
        if (monthly !== null) {
            fromMonthly = Math.min(cost, Math.max(0, monthly - monthlyUsed));
            fromExtra = cost - fromMonthly;
            if (fromExtra > extra) return { ok: false as const, status: status(period, monthly, monthlyUsed, extra) };
        }
        const next = { monthlyUsed: monthlyUsed + fromMonthly, extra: extra - fromExtra };
        tx.set(ref, { uid, period, ...next, updatedAt: Date.now() }, { merge: true });
        tx.create(db.collection('lawyerAiCreditLedger').doc(), {
            uid, delta: -cost, fromMonthly, fromExtra, reason, period, meta, at: Date.now(),
        });
        return { ok: true as const, charge: { period, fromMonthly, fromExtra }, status: status(period, monthly, next.monthlyUsed, next.extra) };
    });
}

/** คืนเครดิตเมื่อ AI ทำงานไม่สำเร็จ — ข้ามเดือนแล้วคืนเฉพาะส่วน extra (ยอดรายเดือนของเดือนเก่ารีเซ็ตไปแล้ว) */
export async function refundCredits(db: Db, uid: string, charge: CreditCharge, reason: string, meta: Record<string, unknown> = {}) {
    const ref = db.collection('lawyerAiCredits').doc(uid);
    try {
        await db.runTransaction(async tx => {
            const snap = await tx.get(ref);
            const period = creditPeriod();
            const cur = read(snap, period);
            const backMonthly = charge.period === period ? Math.min(charge.fromMonthly, cur.monthlyUsed) : 0;
            tx.set(ref, { uid, period, monthlyUsed: cur.monthlyUsed - backMonthly, extra: cur.extra + charge.fromExtra, updatedAt: Date.now() }, { merge: true });
            tx.create(db.collection('lawyerAiCreditLedger').doc(), {
                uid, delta: backMonthly + charge.fromExtra, fromMonthly: -backMonthly, fromExtra: -charge.fromExtra, reason, period, meta, at: Date.now(),
            });
        });
    } catch (e) {
        console.error('[lawyer-ai] refund failed:', e instanceof Error ? e.message : e);
    }
}
