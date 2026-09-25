import 'server-only';

/**
 * คำขอค่าบริการเพิ่มเติมที่ยังค้างชำระของห้องแชท — ใช้ร่วมกันระหว่าง
 * resolvePaymentAmount('additional') กับ markCasePaidAction
 *
 * ในฐานข้อมูลมีสองที่มา:
 *   - `pendingFeeRequest` จาก requestFeeAction() (lawslane-capdeal ก็ใช้ตัวนี้)
 *   - `additionalFeeRequest` (status 'pending') จากการปิดเคสที่ทนายขอยอดเพิ่ม
 *     (lawyer-case-actions.ts)
 * ถ้ามีทั้งคู่ถือ pendingFeeRequest ก่อน ให้ตรงกับ capdeal ที่ใช้ฐานข้อมูลเดียวกัน
 *
 * ไม่มีคำขอค้าง = คืน null → ผู้เรียกต้องปฏิเสธ ห้าม fallback ไปใช้ chat.amount
 * (ยอดรวมทั้งเคส) แบบของเดิม
 */
export type PendingAdditionalFee = {
    source: 'pendingFeeRequest' | 'additionalFeeRequest';
    amount: number;
};

export function getPendingAdditionalFee(
    chat: FirebaseFirestore.DocumentData
): PendingAdditionalFee | null {
    const pending = Number(chat.pendingFeeRequest?.amount);
    if (chat.pendingFeeRequest && Number.isFinite(pending) && pending > 0) {
        return { source: 'pendingFeeRequest', amount: pending };
    }
    const extra = chat.additionalFeeRequest;
    const extraAmount = Number(extra?.amount);
    if (extra && (extra.status ?? 'pending') === 'pending' && Number.isFinite(extraAmount) && extraAmount > 0) {
        return { source: 'additionalFeeRequest', amount: extraAmount };
    }
    return null;
}
