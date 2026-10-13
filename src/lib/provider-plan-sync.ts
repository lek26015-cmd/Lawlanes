import type Stripe from 'stripe';
import { LIVE_STATUSES, PLAN_PRODUCT, type ProviderKind, type StoredPlan } from '@/lib/provider-plans';
import { paidTierForPrice, tierForPrice } from '@/lib/stripe-plans';
import { claimEventTx, isEventClaimedTx } from '@/lib/stripe-webhook';
import type { PlanPricingDoc } from '@/lib/plan-pricing-core';

/** collection ของโปรไฟล์แต่ละแบบ */
export const PROFILE_COLLECTION: Record<ProviderKind, string> = {
    lawyer: 'lawyerProfiles',
    interpreter: 'interpreterProfiles',
};

/**
 * ตัวจอง event ของ webhook นี้ — **ห้ามเปลี่ยนเป็น stripeEvents / stripe_events**
 * CapDeal ใช้ `stripe_events` และได้ event id ชุดเดียวกัน (บัญชี Stripe เดียวกัน) ต้องแยกกัน
 */
export const EVENT_MARKER_COLLECTION = 'providerPlanStripeEvents';

/** เรื่องที่แอดมินต้องดู (คืนเงิน, dispute, ราคาไม่รู้จัก, สมัครซ้อน) — เขียนจาก server เท่านั้น ไม่มี PII */
export const BILLING_ALERTS_COLLECTION = 'billingAlerts';

/** อ่าน kind + profileId จาก metadata ที่เราใส่ตอนสร้าง Checkout — ไม่ใช่ของเรา (เช่น CapDeal) = null */
export function planTarget(metadata: Stripe.Metadata | null | undefined): { kind: ProviderKind; profileId: string } | null {
    const product = metadata?.product;
    const profileId = metadata?.profileId;
    const kind = (Object.keys(PLAN_PRODUCT) as ProviderKind[]).find(k => PLAN_PRODUCT[k] === product);
    if (!kind || !profileId || profileId.includes('/')) return null;
    return { kind, profileId };
}

function periodEnd(sub: Stripe.Subscription): string | null {
    // API ใหม่ย้าย current_period_end ไปไว้ที่ subscription item
    const fromItem = sub.items?.data?.[0]?.current_period_end;
    const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
    const ts = fromItem ?? legacy;
    return typeof ts === 'number' ? new Date(ts * 1000).toISOString() : null;
}

/**
 * แปลง subscription จาก Stripe เป็นค่าที่เก็บบนโปรไฟล์ — แพลนตัดสินจาก Price ID จริง ไม่เชื่อ metadata · ราคาไม่รู้จัก = free
 * `pricing` = ราคากลางที่อ่านมาแล้ว (null = env อย่างเดียว)
 */
export function planFromSubscription(kind: ProviderKind, sub: Stripe.Subscription, pricing: PlanPricingDoc | null): StoredPlan {
    const priceId = sub.items?.data?.[0]?.price?.id ?? null;
    return {
        tier: tierForPrice(kind, priceId, pricing),
        status: sub.status,
        currentPeriodEnd: periodEnd(sub),
        cancelAtPeriodEnd: sub.cancel_at_period_end === true,
        customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        subscriptionId: sub.id,
        priceId,
        updatedAt: new Date().toISOString(),
    };
}

/** Price ที่ไม่อยู่ในตาราง (ไม่ใช่ราคาปัจจุบันหรือราคาเก่าที่รู้จัก) — ต้องไม่ให้แพลนและแจ้งแอดมิน */
export function unknownPriceId(kind: ProviderKind, plan: Pick<StoredPlan, 'priceId'>, pricing: PlanPricingDoc | null): string | null {
    if (!plan.priceId) return null;
    return paidTierForPrice(kind, plan.priceId, pricing) ? null : plan.priceId;
}

export type MergeSkipReason = 'missing' | 'customer_mismatch' | 'stale_subscription' | 'duplicate_subscription';
export type MergeResult = { ok: true; plan: StoredPlan } | { ok: false; reason: MergeSkipReason };

/**
 * ตัดสินว่าจะเขียนแพลนใหม่ทับของเดิมได้ไหม (pure — ทดสอบได้)
 * - customer ไม่ตรงกับที่โปรไฟล์ผูกไว้ → ข้าม (กัน metadata ที่ถูกแก้ใน Dashboard ไปชี้โปรไฟล์คนอื่น)
 * - โปรไฟล์ผูก subscription อื่นที่ยังมีผลอยู่ → ข้าม: ตัวที่มาเป็นตัวเก่าที่จบแล้ว (stale)
 *   หรือเป็นตัวที่สองที่ยังมีผล (duplicate → แจ้งแอดมิน ไม่ยกเลิก/คืนเงินเอง)
 * - `currentLiveOverride` = สถานะจริงของ subscription ที่โปรไฟล์ผูกไว้ (webhook retrieve มาให้)
 *   กันกรณี event ยกเลิกตัวเดิมหายไป แล้วโปรไฟล์ค้างสถานะ active ตลอด
 * - past_due: เก็บเวลาที่เริ่ม past_due ครั้งแรกของ subscription นี้ไว้นับ 3 วัน
 */
export function mergePlan(
    current: Partial<StoredPlan> | null | undefined,
    next: StoredPlan,
    now: Date = new Date(),
    currentLiveOverride?: boolean,
): MergeResult {
    if (current?.customerId && current.customerId !== next.customerId) return { ok: false, reason: 'customer_mismatch' };
    if (current?.subscriptionId && next.subscriptionId && current.subscriptionId !== next.subscriptionId) {
        const currentLive = currentLiveOverride ?? LIVE_STATUSES.includes(String(current.status));
        if (currentLive) {
            return { ok: false, reason: LIVE_STATUSES.includes(next.status) ? 'duplicate_subscription' : 'stale_subscription' };
        }
    }
    let pastDueSince: string | null = null;
    if (next.status === 'past_due') {
        const keep = current?.subscriptionId === next.subscriptionId && current?.status === 'past_due' && current?.pastDueSince;
        pastDueSince = keep ? String(current!.pastDueSince) : now.toISOString();
    }
    return { ok: true, plan: { ...next, pastDueSince } };
}

/**
 * เขียนแพลนลงโปรไฟล์ (หน้า success ของ Checkout เรียก) — ข้ามตามกติกาของ mergePlan
 */
export async function savePlan(
    db: FirebaseFirestore.Firestore,
    kind: ProviderKind,
    profileId: string,
    plan: StoredPlan,
): Promise<boolean> {
    const ref = db.collection(PROFILE_COLLECTION[kind]).doc(profileId);
    return db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) return false;
        const merged = mergePlan(snap.get('plan') as Partial<StoredPlan> | undefined, plan);
        if (!merged.ok) return false;
        tx.update(ref, { plan: merged.plan });
        return true;
    });
}

/** ข้อมูลเตือนแอดมิน — id ภายในและยอดเงินเท่านั้น ห้ามมีชื่อ/อีเมล/เบอร์ */
export type BillingAlert = {
    type: 'unknown_price' | 'duplicate_subscription' | 'profile_not_updated' | 'charge_refunded' | 'dispute_created' | 'async_payment_failed';
    amount?: number | null;
    currency?: string | null;
    detail?: string;
};

export type PlanEventOutcome =
    | { status: 'duplicate' }
    | { status: 'saved'; plan: StoredPlan }
    | { status: 'skipped'; reason: MergeSkipReason };

/**
 * webhook: จอง event + บันทึกแพลน + เขียน billingAlerts ใน transaction เดียว
 * transaction ล้ม = ไม่มีอะไรถูกเขียน (รวมตัวจอง) → ตอบ 500 ให้ Stripe retry ได้
 */
export async function applyPlanEvent(
    db: FirebaseFirestore.Firestore,
    args: {
        event: Pick<Stripe.Event, 'id' | 'type'>;
        kind: ProviderKind;
        profileId: string;
        plan: StoredPlan;
        alerts: BillingAlert[];
        /** สถานะจริงจาก Stripe ของ subscription ที่โปรไฟล์ผูกไว้ (ถ้าเป็นคนละตัวกับ event) */
        verifiedCurrent?: { subscriptionId: string; live: boolean };
    },
): Promise<PlanEventOutcome> {
    const { event, kind, profileId, plan } = args;
    const marker = db.collection(EVENT_MARKER_COLLECTION).doc(event.id);
    const ref = db.collection(PROFILE_COLLECTION[kind]).doc(profileId);
    return db.runTransaction(async tx => {
        // อ่านทั้งหมดก่อน แล้วค่อยเขียน
        if (await isEventClaimedTx(tx, marker)) return { status: 'duplicate' } as const;
        const snap = await tx.get(ref);
        claimEventTx(tx, marker, event);
        const current = snap.exists ? (snap.get('plan') as Partial<StoredPlan> | undefined) : undefined;
        const override = args.verifiedCurrent && args.verifiedCurrent.subscriptionId === current?.subscriptionId
            ? args.verifiedCurrent.live
            : undefined;
        const merged: MergeResult = snap.exists ? mergePlan(current, plan, new Date(), override) : { ok: false, reason: 'missing' };
        const alerts = [...args.alerts];
        if (merged.ok) {
            tx.update(ref, { plan: merged.plan });
        } else {
            alerts.push({ type: merged.reason === 'duplicate_subscription' ? 'duplicate_subscription' : 'profile_not_updated', detail: merged.reason });
        }
        const createdAt = new Date().toISOString();
        for (const a of alerts) {
            tx.set(db.collection(BILLING_ALERTS_COLLECTION).doc(`${event.id}_${a.type}`), {
                type: a.type,
                source: 'lawslane_provider_plans',
                status: 'open',
                eventId: event.id,
                eventType: event.type,
                profileKind: kind,
                profileId,
                subscriptionId: plan.subscriptionId,
                customerId: plan.customerId,
                priceId: plan.priceId ?? null,
                amount: a.amount ?? null,
                currency: a.currency ?? null,
                detail: a.detail ?? null,
                createdAt,
            });
        }
        return merged.ok ? { status: 'saved', plan: merged.plan } as const : { status: 'skipped', reason: merged.reason } as const;
    });
}
