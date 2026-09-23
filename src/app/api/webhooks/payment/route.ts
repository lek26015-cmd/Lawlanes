import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { initAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * เทียบ secret แบบเวลาคงที่ — `!==` ธรรมดาหยุดที่ตัวอักษรแรกที่ต่าง ยิงวัดเวลา
 * ตอบกลับซ้ำๆ แล้วเดา secret ทีละตัวได้ แฮชก่อนเพื่อให้สองฝั่งยาวเท่ากันเสมอ
 * (timingSafeEqual โยน error ถ้าความยาวไม่เท่า และความยาวเองก็ไม่ควรรั่ว)
 */
function secretMatches(received: string, expected: string): boolean {
    const a = createHash('sha256').update(received).digest();
    const b = createHash('sha256').update(expected).digest();
    return timingSafeEqual(a, b);
}

/**
 * Payment Webhook Handler (Stripe / Opn / SlipOK Advanced)
 * Receives payment status updates and securely updates global_stats using Atomic Increment.
 */
export async function POST(request: Request) {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) throw new Error('Firebase Admin not initialized.');
        const db = adminApp.firestore();

        // 1. Webhook Signature Validation
        //
        // เดิมถ้า PAYMENT_WEBHOOK_SECRET ไม่ถูกตั้งค่า โค้ดแค่ console.warn แล้วทำงานต่อ
        // → endpoint นี้เป็นตัวเดียวที่เขียน `transactions` ซึ่งเป็นแหล่งรายได้ที่ทนาย
        // ใช้ขอถอนเงิน ถ้า env หายไปเมื่อไร ใครก็ POST เข้ามาเสกยอดให้ทนายคนไหนก็ได้
        // แล้วเดินเข้าเส้นทางถอนเงินจริง — ต้อง fail closed เท่านั้น
        const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET;
        if (!expectedSecret) {
            console.error('[Webhook] 🚨 PAYMENT_WEBHOOK_SECRET is not configured — refusing every request.');
            return NextResponse.json({ success: false, message: 'Webhook not configured' }, { status: 503 });
        }
        {
            const authHeader = request.headers.get('authorization');
            const webhookHeader = request.headers.get('x-webhook-signature') || request.headers.get('x-slipok-signature');

            // Extract token from Bearer prefix if present, else use raw header
            const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : (webhookHeader || authHeader || '').trim();

            if (!token || !secretMatches(token, expectedSecret)) {
                console.error('[Webhook] 🚨 Unauthorized. Secret mismatch.');
                return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
            }
        }

        // Parse webhook payload (Assume generic schema for this example)
        let body;
        try {
            body = await request.json();
        } catch (parseError) {
            console.error('[Webhook] ❌ Malformed JSON payload:', parseError);
            return NextResponse.json({ success: false, message: 'Invalid JSON payload' }, { status: 400 });
        }
        const { 
            transactionId, 
            sourceId, // e.g., apt_123 or chat_xyz
            lawyerId,
            clientId,
            amount, 
            status, // 'completed' | 'refunded' | 'cancelled'
            type = 'revenue'
        } = body;

        if (!transactionId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
        }

        // GP หักฝั่งเราเสมอ — เดิมรับ platformFee/netAmount มาจาก payload ตรงๆ แปลว่า
        // คนเรียก webhook เป็นคนกำหนดเองว่าทนายได้เท่าไร (ส่ง platformFee: 0 ก็ได้)
        // ทั้งที่ netAmount คือตัวที่ไปเป็นยอดถอนได้ของทนาย
        const settingsSnap = await db.collection('settings').doc('platform').get();
        const feeRate = Number(settingsSnap.data()?.platformFeeRate);
        const platformFeeRate = Number.isFinite(feeRate) && feeRate >= 0 && feeRate <= 1 ? feeRate : 0.15;

        const grossAmount = Math.round(Number(amount) * 100) / 100;
        const platformFee = Math.round(grossAmount * platformFeeRate * 100) / 100;
        const netAmount = Math.round((grossAmount - platformFee) * 100) / 100;

        const txRef = db.collection('transactions').doc(transactionId);
        const globalStatsRef = db.doc('system/global_stats');
        
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Handle Status
        //
        // ทั้งสองทางอ่าน-ตัดสิน-เขียนใน transaction เดียว — เดิมอ่านสถานะแยกแล้วค่อย
        // batch เขียน webhook ที่ผู้ให้บริการยิงซ้ำพร้อมกัน (retry เป็นเรื่องปกติ)
        // ผ่านด่าน idempotency ทั้งคู่แล้วบวก/ลบ global_stats ซ้ำ
        if (status === 'completed') {
            const result = await db.runTransaction(async (tx) => {
                // 2. Idempotency Check
                const txSnap = await tx.get(txRef);
                const current = txSnap.exists ? txSnap.data()?.status : null;
                if (current === 'completed') return 'already';
                // รายการที่กลับรายการไปแล้วห้ามถูกตัดยอดใหม่ด้วย event เก่าที่ยิงซ้ำมา
                // ไม่งั้นรายได้ของทนายกลับมาให้ถอนได้อีกรอบ
                if (current === 'refunded' || current === 'cancelled') return 'reversed';

                const txDoc = {
                    transactionId,
                    sourceId,
                    lawyerId,
                    clientId,
                    amount: grossAmount,
                    platformFee,
                    platformFeeRate,
                    netAmount,
                    type,
                    status: 'completed',
                    createdAt: FieldValue.serverTimestamp()
                };

                const statsPayload: any = {
                    totalServiceValue: FieldValue.increment(grossAmount),
                    platformTotalRevenue: FieldValue.increment(platformFee),
                    lastUpdated: FieldValue.serverTimestamp()
                };
                statsPayload[`monthlyData.${currentMonthKey}`] = FieldValue.increment(platformFee);

                tx.set(txRef, txDoc, { merge: true });
                tx.set(globalStatsRef, statsPayload, { merge: true });
                return 'done';
            });

            if (result === 'already') {
                console.log(`[Webhook] ℹ️ Idempotency check: Transaction ${transactionId} is already marked as completed. Skipping.`);
                return NextResponse.json({ success: true, message: 'Already processed' });
            }
            if (result === 'reversed') {
                console.warn(`[Webhook] ⚠️ Transaction ${transactionId} was already reversed — ignoring late 'completed' event.`);
                return NextResponse.json({ success: true, message: 'Already reversed' });
            }

        } else if (status === 'refunded' || status === 'cancelled') {
            const result = await db.runTransaction(async (tx) => {
                const txSnap = await tx.get(txRef);
                if (!txSnap.exists) return 'not_found';

                // 2. Idempotency Check
                // เดิมเทียบ `status === <สถานะใน payload>` แต่ตอนเขียนกลับบันทึกเป็น
                // 'refunded' เสมอ → event 'cancelled' ที่ยิงซ้ำไม่เคยตรง แล้วหัก
                // global_stats ซ้ำทุกครั้ง ตอนนี้ถือว่ากลับรายการแล้วไม่ว่าจะเป็นแบบไหน
                // และบันทึกสถานะตามจริงของ event
                const booked = txSnap.data()!;
                if (booked.status === 'refunded' || booked.status === 'cancelled') return 'already';

                // กลับรายการต้องหักด้วย "ตัวเลขที่บันทึกไว้ตอนตัดยอด" ไม่ใช่ตัวเลขใน payload
                // ไม่งั้นส่ง amount สูงๆ เข้ามาแล้วดึงยอดรวมของแพลตฟอร์มให้ติดลบได้
                const bookedAmount = Number(booked.amount) || 0;
                const bookedFee = Number(booked.platformFee) || 0;

                // Deduct the amounts if the transaction is cancelled/refunded
                const statsPayload: any = {
                    totalServiceValue: FieldValue.increment(-bookedAmount),
                    platformTotalRevenue: FieldValue.increment(-bookedFee),
                    lastUpdated: FieldValue.serverTimestamp()
                };
                statsPayload[`monthlyData.${currentMonthKey}`] = FieldValue.increment(-bookedFee);

                tx.update(txRef, { status, netAmount: 0, updatedAt: FieldValue.serverTimestamp() });
                tx.set(globalStatsRef, statsPayload, { merge: true });
                return 'done';
            });

            if (result === 'not_found') {
                return NextResponse.json({ success: false, message: 'Transaction not found' }, { status: 404 });
            }
            if (result === 'already') {
                console.log(`[Webhook] ℹ️ Idempotency check: Transaction ${transactionId} is already reversed. Skipping.`);
                return NextResponse.json({ success: true, message: 'Already processed' });
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[Webhook] ❌ Processing error:', error?.message || error);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}
