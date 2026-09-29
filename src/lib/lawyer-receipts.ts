/**
 * ยอดที่ "ทนายยืนยันว่าได้รับแล้ว" จากเอกสาร chats — ใช้แทนสูตรยอดคงเหลือเดิม (lib/lawyer-balance)
 *
 * เดิมรายได้ของทนายมาจาก `transactions` (ยอดสุทธิหลังหัก GP 15% ที่ webhook เขียน) ลบ
 * `withdrawals` → เป็น "ยอดในกระเป๋าที่แพลตฟอร์มถือไว้ให้" ตอนนี้แพลตฟอร์มไม่ถือเงินแล้ว
 * ลูกความโอนเข้าบัญชีทนายตรง ตัวเลขในหลังบ้านทนายจึงเป็นแค่ "บันทึก" ของสิ่งที่ทนายกดยืนยันเอง
 * (confirmDirectPaymentReceivedAction) ไม่มียอดคงเหลือ ไม่มีการถอน ไม่มีการหักเปอร์เซ็นต์
 *
 * ใช้ได้ทั้งฝั่ง server (Admin SDK) และ client (lib/data.ts) — รับแค่ข้อมูลเอกสาร ไม่แตะ SDK
 */

export type LawyerReceipt = {
    chatId: string;
    caseTitle: string;
    clientId: string;
    label: string;
    amount: number;
    /** ISO string — null ถ้าข้อมูลรุ่นเก่าไม่มีวันที่ */
    date: string | null;
};

export type LawyerReceiptSummary = {
    receipts: LawyerReceipt[];
    /** ยอดที่ยืนยันรับแล้วทั้งหมด */
    totalReceived: number;
    /** ยอดที่ยืนยันรับแล้วในเดือนปฏิทินปัจจุบัน */
    receivedThisMonth: number;
    /** ยอดที่เสนอไว้แต่ยังไม่ได้ยืนยันรับ (เคสที่ยังไม่ปิด/ไม่ยกเลิก) */
    outstanding: number;
};

function num(v: unknown): number {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
}

function toIso(v: any): string | null {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (typeof v?.toDate === 'function') return v.toDate().toISOString();
    if (v instanceof Date) return v.toISOString();
    if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
    return null;
}

export function summarizeLawyerReceipts(
    chats: { id: string; data: Record<string, any> }[],
    now: Date = new Date()
): LawyerReceiptSummary {
    const receipts: LawyerReceipt[] = [];
    let outstanding = 0;

    for (const { id, data } of chats) {
        const caseTitle = data.caseTitle || 'เคส';
        const clientId = data.clientId || data.userId || '';
        const installments: any[] = Array.isArray(data.installments) ? data.installments : [];
        let received = 0;

        if (installments.length > 0) {
            installments.forEach((inst, i) => {
                if (inst?.status !== 'paid') return;
                const amount = num(inst.amount);
                received += amount;
                receipts.push({ chatId: id, caseTitle, clientId, label: `งวดที่ ${i + 1}`, amount, date: toIso(inst.paidAt) });
            });
        } else {
            const paid = num(data.paidAmount);
            if (paid > 0) {
                received += paid;
                receipts.push({
                    chatId: id, caseTitle, clientId, label: 'ค่าบริการ', amount: paid,
                    date: toIso(data.paymentConfirmedAt) || toIso(data.paidAt),
                });
            }
        }

        const extras: any[] = Array.isArray(data.additionalPayments) ? data.additionalPayments : [];
        for (const x of extras) {
            const amount = num(x?.amount);
            if (amount <= 0) continue;
            received += amount;
            receipts.push({ chatId: id, caseTitle, clientId, label: x?.reason || 'ค่าบริการเพิ่มเติม', amount, date: toIso(x?.paidAt) });
        }

        const closedOrCancelled = data.status === 'closed' || data.status === 'cancelled';
        if (!closedOrCancelled) {
            const offered = num(data.amount);
            outstanding += Math.max(0, offered - received);
        }
    }

    receipts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const totalReceived = receipts.reduce((s, r) => s + r.amount, 0);
    const receivedThisMonth = receipts
        .filter(r => {
            if (!r.date) return false;
            const d = new Date(r.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((s, r) => s + r.amount, 0);

    return { receipts, totalReceived, receivedThisMonth, outstanding };
}
