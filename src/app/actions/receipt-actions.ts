'use server';

import { requireUser, requireLawyer, authErrorResult, AuthError } from '@/lib/auth-guard';
import type { ReceiptSummary } from '@/lib/receipts/types';

// รายการใบเสร็จส่งเฉพาะข้อมูลที่ต้องโชว์ในตาราง — ที่อยู่/uid อยู่ใน PDF เท่านั้น
function toSummary(doc: FirebaseFirestore.QueryDocumentSnapshot): ReceiptSummary {
    const r = doc.data();
    return {
        id: doc.id,
        receiptNo: r.receiptNo,
        status: r.status,
        issuerName: r.issuer?.name || '',
        payerName: r.payer?.name || null,
        description: (r.items || []).map((i: any) => i.description).join(', '),
        caseTitle: r.caseTitle || null,
        chatId: r.chatId,
        amount: Number(r.amount) || 0,
        paidAt: r.paidAt?.toDate?.().toISOString() || '',
        issuedAt: r.issuedAt?.toDate?.().toISOString() || '',
    };
}

const newestFirst = (a: ReceiptSummary, b: ReceiptSummary) => b.issuedAt.localeCompare(a.issuedAt);

/** ใบเสร็จที่ลูกความได้รับ — uid มาจาก session */
export async function getMyReceiptsAction(): Promise<{ success: true; data: ReceiptSummary[] } | { success: false; error: string }> {
    try {
        const { uid, adminApp } = await requireUser();
        const snap = await adminApp.firestore().collection('receipts').where('payerUid', '==', uid).limit(200).get();
        return { success: true, data: snap.docs.map(toSummary).sort(newestFirst) };
    } catch (e) {
        if (e instanceof AuthError) return authErrorResult(e);
        console.error('getMyReceiptsAction failed:', e);
        return { success: false, error: 'โหลดใบเสร็จไม่สำเร็จ' };
    }
}

/** ใบเสร็จที่ทนายออก — ค้นด้วย id โปรไฟล์ (ใบที่ออกให้ห้องที่มีแค่ uid ทนายก็ผูกกับโปรไฟล์นี้) */
export async function getLawyerReceiptsAction(): Promise<{ success: true; data: ReceiptSummary[] } | { success: false; error: string }> {
    try {
        const { lawyerProfileId, adminApp } = await requireLawyer();
        const snap = await adminApp.firestore().collection('receipts').where('lawyerProfileId', '==', lawyerProfileId).limit(500).get();
        return { success: true, data: snap.docs.map(toSummary).sort(newestFirst) };
    } catch (e) {
        if (e instanceof AuthError) return authErrorResult(e);
        console.error('getLawyerReceiptsAction failed:', e);
        return { success: false, error: 'โหลดใบเสร็จไม่สำเร็จ' };
    }
}
