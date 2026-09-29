import type { Timestamp } from 'firebase-admin/firestore';

/** รายการที่จ่าย — ตรงกับ DirectPaymentType ใน confirmDirectPaymentReceivedAction */
export type ReceiptSource =
    | { type: 'case' }
    | { type: 'installment'; installmentIndex: number }
    | { type: 'additional'; additionalIndex: number };

/**
 * เอกสาร receipts/{chatId}__{รายการ} — เขียนผ่าน Admin SDK เท่านั้น
 * (firestore.rules ไม่มี rule ของ collection นี้ → ตก catch-all deny ทั้งอ่านและเขียนจาก client)
 */
export interface Receipt {
    id: string;
    receiptNo: string;
    status: 'issued' | 'void';
    issuerType: 'lawyer';
    lawyerProfileId: string;
    lawyerUid: string;
    issuer: {
        name: string;
        address: string | null;
        taxId: string | null;
        licenseNumber: string | null;
    };
    payerUid: string;
    payer: {
        name: string | null;
        address: string | null;
    };
    chatId: string;
    caseTitle: string | null;
    source: ReceiptSource;
    items: { description: string; amount: number }[];
    amount: number;
    amountText: string;
    paymentMethod: string | null;
    paidAt: Timestamp;
    confirmedBy: string;
    issuedAt: Timestamp;
    voidReason?: string;
    voidedBy?: string;
    voidedAt?: Timestamp;
}

/** ข้อมูลที่ส่งให้หน้าเว็บ (รายการใบเสร็จ) — ไม่มีที่อยู่/uid */
export interface ReceiptSummary {
    id: string;
    receiptNo: string;
    status: 'issued' | 'void';
    issuerName: string;
    payerName: string | null;
    description: string;
    caseTitle: string | null;
    chatId: string;
    amount: number;
    paidAt: string;
    issuedAt: string;
}
