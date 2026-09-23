'use server';

import * as admin from 'firebase-admin';
import { initAdmin } from '@/lib/firebase-admin';
import { requireUser, AuthError } from '@/lib/auth-guard';
import {
    MIN_WITHDRAWAL_AMOUNT,
    reduceLawyerBalance,
    loadLawyerBalance,
    type LawyerBalance,
} from '@/lib/lawyer-balance';

/**
 * คำร้องขอถอนเงินของทนาย — ต้องคิดและตรวจยอดฝั่ง server เท่านั้น
 *
 * ของเดิม: หน้า lawyer-dashboard/financials ตรวจ `amount > stats.availableBalance`
 * ในเบราว์เซอร์แล้วยิง addDoc(withdrawals, {...}) ตรงๆ ส่วน firestore.rules ก็ตรวจ
 * แค่ `request.resource.data.lawyerId == request.auth.uid` (เจ้าของเท่านั้น) โดย
 * **ไม่ตรวจยอดเลย** → ทนายที่มีรายได้ ฿0 เปิด console ยิง SDK ขอถอน ฿500,000 ได้ทันที
 * และเส้นทางนี้เป็นเส้นทางเดียวในระบบที่เงินสดออกจากบริษัทจริง
 *
 * ตัวนี้จึง:
 *   - เอา lawyerId จาก session ไม่รับเป็น argument
 *   - คิด availableBalance ใหม่จาก Firestore ด้วยสูตรกลาง (lib/lawyer-balance)
 *   - อ่านบัญชีธนาคารจาก lawyerProfiles ไม่รับจากผู้เรียก (กันโอนเข้าบัญชีใครก็ได้)
 *   - ทำทั้งหมดใน transaction เดียว กันการยิงพร้อมกันหลายใบให้รวมเกินยอด
 *   - เก็บ balanceAtRequest ไว้ตรวจย้อนหลังว่าอนุมัติบนข้อมูลอะไร
 */

export type WithdrawalResult =
    | { ok: true; withdrawalId: string; availableBalance: number }
    | { ok: false; error: string };

function fail(e: unknown): WithdrawalResult {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    if (e instanceof WithdrawalRejected) return { ok: false, error: e.message };
    console.error('WITHDRAWAL_ACTION_ERROR', e);
    return { ok: false, error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง' };
}

/** ข้อความที่ตั้งใจให้ผู้ใช้เห็น (ต่างจาก error ภายในที่ต้องกลบ) */
class WithdrawalRejected extends Error {}

export async function requestWithdrawal(input: { amount: number }): Promise<WithdrawalResult> {
    try {
        const { uid: lawyerId } = await requireUser();
        const app = await initAdmin();
        if (!app) return { ok: false, error: 'ระบบยังไม่พร้อม' };
        const db = app.firestore();

        const amount = Number(input?.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            return { ok: false, error: 'กรุณาระบุจำนวนเงินที่ถูกต้อง' };
        }
        // ยอดเงินต้องละเอียดไม่เกินสตางค์ — เดิมรับ 1000.004 ได้ แล้วเศษทศนิยมไปสะสม
        // ในผลรวมของ reduceLawyerBalance (float) จนยอดคงเหลือเพี้ยนและอาจถอนเกินได้
        // ทีละเศษ ปฏิเสธแทนการปัดเงียบๆ เพื่อไม่ให้ยอดที่บันทึกต่างจากที่ทนายกรอก
        if (Math.round(amount * 100) / 100 !== amount) {
            return { ok: false, error: 'จำนวนเงินต้องมีทศนิยมไม่เกิน 2 ตำแหน่ง' };
        }
        if (amount < MIN_WITHDRAWAL_AMOUNT) {
            return { ok: false, error: `ต้องถอนเงินขั้นต่ำ ${MIN_WITHDRAWAL_AMOUNT.toLocaleString()} บาทขึ้นไป` };
        }

        // บัญชีรับเงินมาจากโปรไฟล์เท่านั้น — ผู้เรียกกำหนดปลายทางเองไม่ได้
        const profileSnap = await db.collection('lawyerProfiles').doc(lawyerId).get();
        const profile = profileSnap.data() ?? {};
        const bankName = profile.bankName ?? '';
        const accountNumber = profile.bankAccountNumber ?? '';
        const accountName = profile.bankAccountName ?? profile.name ?? '';
        if (!bankName || !accountNumber || !accountName) {
            return { ok: false, error: 'กรุณากรอกข้อมูลบัญชีธนาคารให้ครบถ้วนก่อนขอถอนเงิน' };
        }

        const txQuery = db.collection('transactions').where('lawyerId', '==', lawyerId);
        const wdQuery = db.collection('withdrawals').where('lawyerId', '==', lawyerId);
        const withdrawalRef = db.collection('withdrawals').doc();

        const balance = await db.runTransaction(async (tx) => {
            // อ่านทั้งหมดก่อนเขียนเสมอ — ข้อบังคับของ Firestore transaction
            const [txSnap, wdSnap] = await Promise.all([tx.get(txQuery), tx.get(wdQuery)]);
            const current = reduceLawyerBalance(txSnap.docs, wdSnap.docs);

            if (current.hasPendingWithdrawal) {
                throw new WithdrawalRejected('คุณมีคำร้องขอถอนเงินที่รอดำเนินการอยู่แล้ว กรุณารอให้คำร้องเดิมเสร็จสิ้นก่อน');
            }
            if (amount > current.availableBalance) {
                throw new WithdrawalRejected(
                    `ยอดเงินที่ถอนได้มีเพียง ฿${current.availableBalance.toLocaleString()} ไม่เพียงพอต่อคำร้องนี้`
                );
            }

            tx.set(withdrawalRef, {
                lawyerId,
                amount,
                bankName,
                accountNumber,
                accountName,
                status: 'pending',
                requestedAt: admin.firestore.FieldValue.serverTimestamp(),
                // ภาพยอดคงเหลือ ณ วินาทีที่ยื่นคำร้อง — ไว้ตรวจย้อนหลังว่าอนุมัติบนข้อมูลอะไร
                balanceAtRequest: {
                    totalIncome: current.totalIncome,
                    withdrawnAmount: current.withdrawnAmount,
                    pendingWithdrawal: current.pendingWithdrawal,
                    availableBalance: current.availableBalance,
                },
            });

            return current;
        });

        // แจ้งแอดมิน — ของเดิม client เขียน notifications เอง
        await db.collection('notifications').add({
            type: 'withdrawal',
            title: 'คำร้องขอถอนเงินใหม่',
            message: `มีคำร้องขอถอนเงินจากทนายความ (฿${amount.toLocaleString()})`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
            recipient: 'admin',
            link: `/admin/financials`,
            relatedId: lawyerId,
        });

        return {
            ok: true,
            withdrawalId: withdrawalRef.id,
            availableBalance: balance.availableBalance - amount,
        };
    } catch (e) {
        return fail(e);
    }
}

/** ยอดคงเหลือของผู้เรียกเอง — ใช้ตอนเปิดกล่องขอถอนเพื่อให้เห็นตัวเลขล่าสุด */
export async function getMyWithdrawableBalance(): Promise<
    { ok: true; balance: LawyerBalance } | { ok: false; error: string }
> {
    try {
        const { uid } = await requireUser();
        const app = await initAdmin();
        if (!app) return { ok: false, error: 'ระบบยังไม่พร้อม' };
        return { ok: true, balance: await loadLawyerBalance(app.firestore(), uid) };
    } catch (e) {
        const r = fail(e);
        return { ok: false, error: r.ok ? 'เกิดข้อผิดพลาด' : r.error };
    }
}
