import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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

            if (token !== expectedSecret) {
                console.error(`[Webhook] 🚨 Unauthorized. Secret mismatch. Received token length: ${token?.length}`);
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
        if (status === 'completed') {
            // 2. Idempotency Check
            const txSnap = await txRef.get();
            if (txSnap.exists && txSnap.data()?.status === 'completed') {
                console.log(`[Webhook] ℹ️ Idempotency check: Transaction ${transactionId} is already marked as completed. Skipping.`);
                return NextResponse.json({ success: true, message: 'Already processed' });
            }

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

            const batch = db.batch();
            batch.set(txRef, txDoc, { merge: true });
            batch.set(globalStatsRef, statsPayload, { merge: true });
            await batch.commit();

        } else if (status === 'refunded' || status === 'cancelled') {
            // 2. Idempotency Check
            const txSnap = await txRef.get();
            if (txSnap.exists && txSnap.data()?.status === status) {
                console.log(`[Webhook] ℹ️ Idempotency check: Transaction ${transactionId} is already marked as ${status}. Skipping.`);
                return NextResponse.json({ success: true, message: 'Already processed' });
            }

            if (!txSnap.exists) {
                return NextResponse.json({ success: false, message: 'Transaction not found' }, { status: 404 });
            }

            // กลับรายการต้องหักด้วย "ตัวเลขที่บันทึกไว้ตอนตัดยอด" ไม่ใช่ตัวเลขใน payload
            // ไม่งั้นส่ง amount สูงๆ เข้ามาแล้วดึงยอดรวมของแพลตฟอร์มให้ติดลบได้
            const booked = txSnap.data()!;
            const bookedAmount = Number(booked.amount) || 0;
            const bookedFee = Number(booked.platformFee) || 0;

            // Deduct the amounts if the transaction is cancelled/refunded
            const statsPayload: any = {
                totalServiceValue: FieldValue.increment(-bookedAmount),
                platformTotalRevenue: FieldValue.increment(-bookedFee),
                lastUpdated: FieldValue.serverTimestamp()
            };
            statsPayload[`monthlyData.${currentMonthKey}`] = FieldValue.increment(-bookedFee);

            const batch = db.batch();
            batch.update(txRef, { status: 'refunded', netAmount: 0, updatedAt: FieldValue.serverTimestamp() });
            batch.set(globalStatsRef, statsPayload, { merge: true });
            await batch.commit();
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[Webhook] ❌ Processing error:', error?.message || error);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}
