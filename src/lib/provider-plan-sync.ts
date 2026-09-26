import type Stripe from 'stripe';
import { PLAN_PRODUCT, type ProviderKind, type StoredPlan } from '@/lib/provider-plans';
import { tierForPrice } from '@/lib/stripe-plans';

/** collection ของโปรไฟล์แต่ละแบบ */
export const PROFILE_COLLECTION: Record<ProviderKind, string> = {
    lawyer: 'lawyerProfiles',
    interpreter: 'interpreterProfiles',
};

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

/** แปลง subscription จาก Stripe เป็นค่าที่เก็บบนโปรไฟล์ — แพลนตัดสินจาก Price ID จริง ไม่เชื่อ metadata */
export function planFromSubscription(kind: ProviderKind, sub: Stripe.Subscription): StoredPlan {
    const priceId = sub.items?.data?.[0]?.price?.id ?? null;
    return {
        tier: tierForPrice(kind, priceId),
        status: sub.status,
        currentPeriodEnd: periodEnd(sub),
        cancelAtPeriodEnd: sub.cancel_at_period_end === true,
        customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        subscriptionId: sub.id,
        priceId,
        updatedAt: new Date().toISOString(),
    };
}

/**
 * เขียนแพลนลงโปรไฟล์ — ข้ามถ้า customer ไม่ตรงกับที่โปรไฟล์ผูกไว้
 * (กัน subscription ที่ metadata ถูกแก้ใน Dashboard ไปชี้โปรไฟล์คนอื่น)
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
        const current = snap.get('plan') as Partial<StoredPlan> | undefined;
        if (current?.customerId && current.customerId !== plan.customerId) return false;
        tx.update(ref, { plan });
        return true;
    });
}
