import type Stripe from 'stripe';
import { LIVE_STATUSES } from '@/lib/provider-plans';
import {
    applyPlanEvent,
    EVENT_MARKER_COLLECTION,
    planFromSubscription,
    planTarget,
    PROFILE_COLLECTION,
    unknownPriceId,
    type BillingAlert,
    type MergeSkipReason,
} from '@/lib/provider-plan-sync';
import { idOf } from '@/lib/stripe-webhook';

/**
 * ประมวลผล event ของ webhook แพลนทนาย/ล่าม (แยกจาก route เพื่อทดสอบได้โดยไม่เรียก Stripe จริง)
 *
 * กติกา (PLAN-08 หลักความปลอดภัยข้อ 4–5):
 * - สถานะ subscription มาจาก `subscriptions.retrieve` ทุกครั้ง — event อาจมาไม่ตามลำดับ
 *   ข้อมูลใน event.data.object ใช้แค่หา id ของ subscription และยอดเงินสำหรับแจ้งแอดมิน
 * - ไม่ใช่ของเรา (metadata.product ไม่ใช่ lawyer_plan / interpreter_plan เช่นของ CapDeal) → ignored
 * - Price ไม่รู้จัก → ไม่ให้แพลน (tier free) + billingAlerts ห้ามเดา
 * - คืนเงิน / dispute / สมัครซ้อน → billingAlerts ให้แอดมินตัดสินใจ ไม่คืนเงินหรือยกเลิกเอง
 */

export const HANDLED_EVENTS = new Set<string>([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid',
    'invoice.payment_failed',
    'charge.refunded',
    'charge.dispute.created',
]);

export type PlanEventResult =
    | { status: 'ignored' }
    | { status: 'duplicate' }
    | { status: 'saved'; tier: string }
    | { status: 'skipped'; reason: MergeSkipReason };

/** subscription ของเราตัวล่าสุดของ customer — ใช้เมื่อหาจาก invoice ไม่ได้ */
async function latestOwnSubscription(stripe: Stripe, customerId: string): Promise<string | null> {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
    const ours = subs.data.filter(s => planTarget(s.metadata)).sort((a, b) => b.created - a.created);
    return ours[0]?.id ?? null;
}

/**
 * charge / dispute → subscription (API ปัจจุบันไม่มี charge.invoice แล้ว)
 * 1) payment_intent → invoice payment → invoice.parent.subscription_details.subscription
 * 2) ไม่เจอ → customer (จาก charge) → subscription ของเราตัวล่าสุด
 */
async function subscriptionForPayment(
    stripe: Stripe,
    ref: { paymentIntentId: string | null; customerId: string | null; chargeId: string | null },
): Promise<string | null> {
    if (ref.paymentIntentId) {
        const payments = await stripe.invoicePayments.list({
            payment: { type: 'payment_intent', payment_intent: ref.paymentIntentId },
            limit: 1,
            expand: ['data.invoice'],
        });
        const invoice = payments.data[0]?.invoice;
        if (invoice && typeof invoice !== 'string' && 'parent' in invoice) {
            const sub = idOf(invoice.parent?.subscription_details?.subscription);
            if (sub) return sub;
        }
    }
    let customerId = ref.customerId;
    if (!customerId && ref.chargeId) customerId = idOf((await stripe.charges.retrieve(ref.chargeId)).customer);
    return customerId ? latestOwnSubscription(stripe, customerId) : null;
}

/** หา subscription id ที่ event นี้เกี่ยวข้อง + ข้อมูลเตือนแอดมิน (ไม่ใช้สถานะจาก payload) */
async function locate(stripe: Stripe, event: Stripe.Event): Promise<{ subscriptionId: string | null; alerts: BillingAlert[] }> {
    switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
        case 'checkout.session.async_payment_failed': {
            const session = event.data.object;
            if (session.mode !== 'subscription' || !planTarget(session.metadata)) return { subscriptionId: null, alerts: [] };
            const alerts: BillingAlert[] = event.type === 'checkout.session.async_payment_failed'
                ? [{ type: 'async_payment_failed', amount: session.amount_total, currency: session.currency }]
                : [];
            return { subscriptionId: idOf(session.subscription), alerts };
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
            return { subscriptionId: event.data.object.id, alerts: [] };
        case 'invoice.paid':
        case 'invoice.payment_failed':
            return { subscriptionId: idOf(event.data.object.parent?.subscription_details?.subscription), alerts: [] };
        case 'charge.refunded': {
            const charge = event.data.object;
            const subscriptionId = await subscriptionForPayment(stripe, {
                paymentIntentId: idOf(charge.payment_intent),
                customerId: idOf(charge.customer),
                chargeId: charge.id,
            });
            return { subscriptionId, alerts: [{ type: 'charge_refunded', amount: charge.amount_refunded, currency: charge.currency }] };
        }
        case 'charge.dispute.created': {
            const dispute = event.data.object;
            const subscriptionId = await subscriptionForPayment(stripe, {
                paymentIntentId: idOf(dispute.payment_intent),
                customerId: null,
                chargeId: idOf(dispute.charge),
            });
            // reason เป็นรหัสจาก Stripe (เช่น fraudulent) ไม่ใช่ข้อความจากลูกค้า
            return { subscriptionId, alerts: [{ type: 'dispute_created', amount: dispute.amount, currency: dispute.currency, detail: dispute.reason }] };
        }
        default:
            return { subscriptionId: null, alerts: [] };
    }
}

function isMissing(e: unknown): boolean {
    return (e as { code?: string; statusCode?: number })?.code === 'resource_missing' || (e as { statusCode?: number })?.statusCode === 404;
}

/**
 * ประมวลผล event ที่ตรวจลายเซ็นแล้ว — throw = ให้ route ตอบ 500 (Stripe retry · ไม่มีอะไรถูกเขียน)
 */
export async function processPlanEvent(stripe: Stripe, db: FirebaseFirestore.Firestore, event: Stripe.Event): Promise<PlanEventResult> {
    if (!HANDLED_EVENTS.has(event.type)) return { status: 'ignored' };

    // เช็คก่อนเรียก Stripe (ประหยัด) — transaction ด้านล่างเช็คซ้ำอีกครั้งตอนจองจริง
    if ((await db.collection(EVENT_MARKER_COLLECTION).doc(event.id).get()).exists) return { status: 'duplicate' };

    const { subscriptionId, alerts } = await locate(stripe, event);
    if (!subscriptionId) return { status: 'ignored' };

    // สถานะล่าสุดจาก Stripe เสมอ
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const target = planTarget(sub.metadata);
    if (!target) return { status: 'ignored' };

    const plan = planFromSubscription(target.kind, sub);
    const unknown = unknownPriceId(target.kind, plan);
    if (unknown) {
        console.error('provider plan: unknown price — no tier granted', { eventId: event.id, subscriptionId: sub.id, priceId: unknown });
        alerts.push({ type: 'unknown_price', detail: unknown });
    }

    // โปรไฟล์ผูก subscription อื่นอยู่ → ถามสถานะจริงของตัวนั้นจาก Stripe (กันตัวเก่าที่จบแล้วค้างเป็น active)
    let verifiedCurrent: { subscriptionId: string; live: boolean } | undefined;
    const profile = await db.collection(PROFILE_COLLECTION[target.kind]).doc(target.profileId).get();
    const storedSubId = profile.exists ? (profile.get('plan.subscriptionId') as string | null | undefined) : null;
    if (storedSubId && storedSubId !== sub.id) {
        try {
            const stored = await stripe.subscriptions.retrieve(storedSubId);
            verifiedCurrent = { subscriptionId: storedSubId, live: LIVE_STATUSES.includes(stored.status) };
        } catch (e) {
            if (!isMissing(e)) throw e;
            verifiedCurrent = { subscriptionId: storedSubId, live: false };
        }
    }

    const outcome = await applyPlanEvent(db, { event, kind: target.kind, profileId: target.profileId, plan, alerts, verifiedCurrent });
    if (outcome.status === 'skipped') {
        console.error('provider plan not saved', { eventId: event.id, kind: target.kind, profileId: target.profileId, subscriptionId: sub.id, reason: outcome.reason });
        return outcome;
    }
    if (outcome.status === 'duplicate') return outcome;
    return { status: 'saved', tier: outcome.plan.tier };
}
