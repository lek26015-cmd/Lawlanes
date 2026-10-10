import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe-plans';
import { verifyStripeEvent } from '@/lib/stripe-webhook';
import { processPlanEvent } from '@/lib/provider-plan-webhook';

/**
 * Webhook แพลนทนาย/ล่าม — endpoint แยกจาก CapDeal (บัญชี Stripe เดียวกัน)
 * ตั้งใน Stripe Dashboard → Webhooks → https://www.lawslane.com/api/webhooks/stripe-plans
 * events: checkout.session.completed, checkout.session.async_payment_succeeded/failed,
 *         customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed,
 *         charge.refunded, charge.dispute.created
 * secret ของ endpoint นี้ → env STRIPE_PLANS_WEBHOOK_SECRET
 *
 * logic อยู่ที่ src/lib/provider-plan-webhook.ts — สถานะจาก subscriptions.retrieve เสมอ,
 * event ที่ metadata ไม่ใช่ของเรา (เช่น CapDeal) ตอบ 200 แล้วข้าม,
 * กันประมวลผลซ้ำด้วย providerPlanStripeEvents/{event.id} (จองใน transaction เดียวกับการบันทึกแพลน)
 */
export async function POST(req: Request) {
    const stripe = getStripe();
    const secret = process.env.STRIPE_PLANS_WEBHOOK_SECRET?.trim();
    if (!stripe || !secret) return NextResponse.json({ error: 'not configured' }, { status: 500 });

    const event = verifyStripeEvent(stripe, await req.text(), req.headers.get('stripe-signature'), secret);
    if (!event) return NextResponse.json({ error: 'invalid signature' }, { status: 400 });

    const adminApp = await initAdmin();
    if (!adminApp) return NextResponse.json({ error: 'server not ready' }, { status: 500 });

    try {
        const result = await processPlanEvent(stripe, adminApp.firestore(), event);
        return NextResponse.json({ received: true, status: result.status });
    } catch (error) {
        // transaction ไม่ commit = ไม่มีตัวจอง → Stripe retry แล้วประมวลผลใหม่ได้ · log แค่ชนิด/ข้อความ ไม่ log payload
        console.error('stripe-plans webhook error', event.type, event.id, (error as Error)?.message);
        return NextResponse.json({ error: 'processing failed' }, { status: 500 });
    }
}
