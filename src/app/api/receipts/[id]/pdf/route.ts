import { requireUser, authErrorResponse } from '@/lib/auth-guard';
import { generateReceiptPdf } from '@/lib/receipts/receipt-pdf';

export const runtime = 'nodejs';

/**
 * ดาวน์โหลดใบเสร็จเป็น PDF — สร้างใหม่ทุกครั้งจากสำเนาข้อมูลในเอกสาร receipts
 * ไม่เก็บไฟล์ไว้ที่ไหน ไม่มีลิงก์สาธารณะ เปิดได้เฉพาะลูกความเจ้าของใบ ทนายผู้ออก และแอดมิน
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    let uid: string, token: Record<string, any>, adminApp;
    try {
        ({ uid, token, adminApp } = await requireUser());
    } catch (e) {
        return authErrorResponse(e);
    }

    const { id } = await params;
    const snap = await adminApp.firestore().collection('receipts').doc(id).get();
    // ไม่มีสิทธิ์ตอบ 404 เหมือนไม่มีใบนี้ — ไม่บอกว่า id นี้มีอยู่จริง
    if (!snap.exists) return Response.json({ error: 'Not found' }, { status: 404 });
    const r = snap.data()!;
    const isAdmin = token.admin === true || token.role === 'admin';
    if (!isAdmin && r.payerUid !== uid && r.lawyerUid !== uid) {
        return Response.json({ error: 'Not found' }, { status: 404 });
    }

    try {
        const pdf = await generateReceiptPdf({
            receiptNo: r.receiptNo,
            status: r.status,
            voidReason: r.voidReason,
            issuer: r.issuer,
            payer: r.payer,
            caseTitle: r.caseTitle,
            items: r.items,
            amount: r.amount,
            amountText: r.amountText,
            paymentMethod: r.paymentMethod,
            paidAt: r.paidAt.toDate(),
            issuedAt: r.issuedAt.toDate(),
        });
        return new Response(Buffer.from(pdf), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${r.receiptNo}.pdf"`,
                'Cache-Control': 'private, no-store',
                'X-Robots-Tag': 'noindex',
            },
        });
    } catch (e) {
        console.error('receipt pdf failed:', e);
        return Response.json({ error: 'สร้างใบเสร็จไม่สำเร็จ' }, { status: 500 });
    }
}
