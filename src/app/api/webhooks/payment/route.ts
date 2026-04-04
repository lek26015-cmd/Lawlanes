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
        const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET;
        if (expectedSecret) {
            const authHeader = request.headers.get('authorization');
            const webhookHeader = request.headers.get('x-webhook-signature') || request.headers.get('x-slipok-signature');
            
            // Extract token from Bearer prefix if present, else use raw header
            const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : (webhookHeader || authHeader || '').trim();

            if (token !== expectedSecret) {
                console.error(`[Webhook] 🚨 Unauthorized. Secret mismatch. Received token length: ${token?.length}`);
                return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
            }
        } else {
            console.warn('[Webhook] ⚠️ PAYMENT_WEBHOOK_SECRET is not set in environment variables. Webhook is running insecurely!');
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
            platformFee, 
            netAmount, 
            status, // 'completed' | 'refunded' | 'cancelled'
            type = 'revenue'
        } = body;

        if (!transactionId || !amount) {
            return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
        }

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
                amount,
                platformFee,
                netAmount,
                type,
                status: 'completed',
                createdAt: FieldValue.serverTimestamp()
            };

            const statsPayload: any = {
                totalServiceValue: FieldValue.increment(amount),
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

            // Deduct the amounts if the transaction is cancelled/refunded
            const statsPayload: any = {
                totalServiceValue: FieldValue.increment(-amount),
                platformTotalRevenue: FieldValue.increment(-platformFee),
                lastUpdated: FieldValue.serverTimestamp()
            };
            statsPayload[`monthlyData.${currentMonthKey}`] = FieldValue.increment(-platformFee);

            const batch = db.batch();
            batch.update(txRef, { status: 'refunded', updatedAt: FieldValue.serverTimestamp() });
            batch.set(globalStatsRef, statsPayload, { merge: true });
            await batch.commit();
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[Webhook] ❌ Processing error:', error?.message || error);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}
