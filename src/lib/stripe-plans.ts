import Stripe from 'stripe';
import type { PaidTier, PlanTier, ProviderKind } from '@/lib/provider-plans';

/**
 * Stripe สำหรับแพลนผู้ให้บริการ — บัญชีเดียวกับ CapDeal (STRIPE_SECRET_KEY)
 * ราคาแต่ละแพลนตั้งใน Stripe Dashboard แล้วใส่ Price ID ใน env (ไม่เขียนราคาในโค้ด)
 */
let client: Stripe | null = null;

export function getStripe(): Stripe | null {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) return null;
    if (!client) client = new Stripe(key, { appInfo: { name: 'Lawslane Provider Plans' } });
    return client;
}

const PRICE_ENV: Record<ProviderKind, Record<PaidTier, string>> = {
    lawyer: { pro: 'STRIPE_PRICE_LAWYER_PRO', top: 'STRIPE_PRICE_LAWYER_TOP' },
    interpreter: { pro: 'STRIPE_PRICE_INTERPRETER_PRO', top: 'STRIPE_PRICE_INTERPRETER_TOP' },
};

export function priceIdFor(kind: ProviderKind, tier: PaidTier): string | null {
    return process.env[PRICE_ENV[kind][tier]]?.trim() || null;
}

/** Price ID → แพลน — ใช้ตัดสินแพลนจาก subscription จริง (เปลี่ยนแพลนผ่าน portal ก็ถูกต้อง) */
export function tierForPrice(kind: ProviderKind, priceId: string | null | undefined): PlanTier {
    if (!priceId) return 'free';
    if (priceId === priceIdFor(kind, 'top')) return 'top';
    if (priceId === priceIdFor(kind, 'pro')) return 'pro';
    return 'free';
}
