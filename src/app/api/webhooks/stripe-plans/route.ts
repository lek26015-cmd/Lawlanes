import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { initAdmin } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe-plans';
import { planFromSubscription, planTarget, savePlan } from '@/lib/provider-plan-sync';

/**
 * Webhook แพลนทนาย/ล่าม — endpoint แยกจาก CapDeal (บัญชี Stripe เดียวกัน)
 * ตั้งใน Stripe Dashboard → Webhooks → https://www.lawslane.com/api/webhooks/stripe-plans
 * events: checkout.session.completed, customer.subscription.created/updated/deleted,
 *         invoice.paid, invoice.payment_failed
 * secret ของ endpoint นี้ → env STRIPE_PLANS_WEBHOOK_SECRET
 *
 * event ที่ metadata ไม่ใช่ของเรา (เช่น CapDeal) ตอบ 200 แล้วข้าม
 * กันประมวลผลซ้ำตอน Stripe retry ด้วย doc providerPlanStripeEvents/{event.id}
 */
export async function POST(req: Request) {
    const stripe = getStripe();
    const secret = process.env.STRIPE_PLANS_WEBHOOK_SECRET?.trim();
    if (!stripe || !secret) return NextResponse.json({ error: 'not configured' }, { status: 500 });

    const signature = req.headers.get('stripe-signature');
    if (!signature) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
    } catch {
        return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
    }

    const subscriptionFor = async (): Promise<Stripe.Subscription | null> => {
        const obj = event.data.object as unknown as Record<string, any>;
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                return obj as Stripe.Subscription;
            case 'checkout.session.completed': {
                if (!planTarget(obj.metadata) || !obj.subscription) return null;
                const id = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription.id;
                return stripe.subscriptions.retrieve(id);
            }
            case 'invoice.paid':
            case 'invoice.payment_failed': {
                // API ใหม่: invoice.parent.subscription_details.subscription · API เก่า: invoice.subscription
                const ref = obj.parent?.subscription_details?.subscription ?? obj.subscription;
                if (!ref) return null;
                return stripe.subscriptions.retrieve(typeof ref === 'string' ? ref : ref.id);
            }
            default:
                return null;
        }
    };

    const adminApp = await initAdmin();
    if (!adminApp) return NextResponse.json({ error: 'server not ready' }, { status: 500 });
    const db = adminApp.firestore();
    const marker = db.collection('providerPlanStripeEvents').doc(event.id);

    try {
        const sub = await subscriptionFor();
        const target = sub ? planTarget(sub.metadata) : null;
        if (!sub || !target) return NextResponse.json({ received: true, ignored: true });

        try {
            await marker.create({ type: event.type, at: new Date().toISOString() });
        } catch {
            return NextResponse.json({ received: true, duplicate: true });
        }

        const saved = await savePlan(db, target.kind, target.profileId, planFromSubscription(target.kind, sub));
        if (!saved) console.error('provider plan not saved (profile missing or customer mismatch)', target, sub.id);
        return NextResponse.json({ received: true });
    } catch (error) {
        // ลบ marker ให้ Stripe retry แล้วประมวลผลใหม่ได้
        await marker.delete().catch(() => {});
        console.error('stripe-plans webhook error', event.type, error);
        return NextResponse.json({ error: 'processing failed' }, { status: 500 });
    }
}
