import Stripe from 'stripe';
import type { PaidTier, PlanTier, ProviderKind } from '@/lib/provider-plans';
import { resolvePlanFromPrice, type PriceTable } from '@/lib/stripe-webhook';

/**
 * Stripe สำหรับแพลนผู้ให้บริการ — บัญชีเดียวกับ CapDeal (STRIPE_SECRET_KEY)
 * ราคาแต่ละแพลนตั้งใน Stripe Dashboard แล้วใส่ Price ID ใน env (ไม่เขียนราคาในโค้ด)
 * STRIPE_SECRET_KEY ต้องเป็น Restricted key (rk_…) ของเว็บนี้เท่านั้น — ดูสิทธิ์ที่ต้องเปิดใน .env.example
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

/** Price เก่าที่ยังรู้จัก (ผู้สมัครเดิมยังใช้) — env `<ชื่อ>_PREVIOUS` คั่นด้วย comma */
function previousPriceIds(kind: ProviderKind, tier: PaidTier): string[] {
    return (process.env[`${PRICE_ENV[kind][tier]}_PREVIOUS`] || '').split(',').map(s => s.trim()).filter(Boolean);
}

function priceTable(kind: ProviderKind): PriceTable<PaidTier> {
    return {
        top: { current: priceIdFor(kind, 'top'), previous: previousPriceIds(kind, 'top') },
        pro: { current: priceIdFor(kind, 'pro'), previous: previousPriceIds(kind, 'pro') },
    };
}

/** Price ID → แพลนเสียเงิน · ไม่รู้จัก = null (ห้ามให้แพลน ให้ log ลง billingAlerts) */
export function paidTierForPrice(kind: ProviderKind, priceId: string | null | undefined): PaidTier | null {
    return resolvePlanFromPrice(priceTable(kind), priceId);
}

/** Price ID → แพลน — ใช้ตัดสินแพลนจาก subscription จริง (เปลี่ยนแพลนผ่าน portal ก็ถูกต้อง) · ไม่รู้จัก = free */
export function tierForPrice(kind: ProviderKind, priceId: string | null | undefined): PlanTier {
    return paidTierForPrice(kind, priceId) ?? 'free';
}
