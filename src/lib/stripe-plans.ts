import Stripe from 'stripe';
import type { PaidTier, PlanTier, ProviderKind } from '@/lib/provider-plans';
import { resolvePlanFromPrice, type PriceTable } from '@/lib/stripe-webhook';
import type { PlanPricingDoc, PlanPricingPlan } from '@/lib/plan-pricing-core';

/**
 * Stripe สำหรับแพลนผู้ให้บริการ — บัญชีเดียวกับ CapDeal (STRIPE_SECRET_KEY)
 * ราคาแพลนทนายอ่านจากราคากลาง `planPricing/lawyer` (หน้า admin ตั้ง) ถ้าไม่มีใช้ Price ID ใน env แบบเดิม
 * แพลนล่ามใช้ env อย่างเดียว · ไม่เขียนราคาในโค้ด
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

/** Price ID จาก env (แบบเดิม) — ใช้เมื่อราคากลางไม่มีแพลนนี้ */
function envPriceId(kind: ProviderKind, tier: PaidTier): string | null {
    return process.env[PRICE_ENV[kind][tier]]?.trim() || null;
}

/** Price เก่าที่ยังรู้จัก (ผู้สมัครเดิมยังใช้) — env `<ชื่อ>_PREVIOUS` คั่นด้วย comma */
function envPreviousPriceIds(kind: ProviderKind, tier: PaidTier): string[] {
    return (process.env[`${PRICE_ENV[kind][tier]}_PREVIOUS`] || '').split(',').map(s => s.trim()).filter(Boolean);
}

/** แพลนในราคากลาง (เฉพาะทนาย — ล่ามใช้ env อย่างเดียว) */
function pricingPlan(kind: ProviderKind, tier: PaidTier, pricing: PlanPricingDoc | null): PlanPricingPlan | null {
    if (kind !== 'lawyer' || !pricing) return null;
    return pricing.plans[tier] ?? null;
}

/**
 * Price ID รายเดือนที่ใช้สร้าง Checkout — ราคากลางก่อน ไม่มีค่อยใช้ env
 * `pricing` = เอกสาร planPricing ที่อ่านมาแล้ว (null = ไม่มี/อ่านไม่ได้ → env เหมือนเดิม)
 * แพลนที่ราคากลางตั้ง monthly = null คือไม่ขาย → null (checkout ปฏิเสธ)
 */
export function priceIdFor(kind: ProviderKind, tier: PaidTier, pricing: PlanPricingDoc | null): string | null {
    const plan = pricingPlan(kind, tier, pricing);
    if (plan && !plan.malformed) {
        if (plan.monthly === null) return null;
        if (plan.stripe?.monthlyPriceId) return plan.stripe.monthlyPriceId;
    }
    return envPriceId(kind, tier);
}

/** ทุก Price ที่รู้จักของแพลนหนึ่ง: ราคากลาง (ปัจจุบัน + previousPriceIds) + env + env `_PREVIOUS` */
function knownPrices(kind: ProviderKind, tier: PaidTier, pricing: PlanPricingDoc | null): { current: string | null; previous: string[] } {
    const stripe = pricingPlan(kind, tier, pricing)?.stripe;
    const all = [
        stripe?.monthlyPriceId,
        stripe?.yearlyPriceId,
        ...(stripe?.previousPriceIds ?? []),
        envPriceId(kind, tier),
        ...envPreviousPriceIds(kind, tier),
    ].filter((id): id is string => !!id);
    // แพลนที่เลิกขายแล้ว (monthly = null) ยังต้องรู้จัก Price ของผู้สมัครเดิม — ไม่ได้ใช้ priceIdFor ตรงนี้
    return { current: all[0] ?? null, previous: all.slice(1) };
}

function priceTable(kind: ProviderKind, pricing: PlanPricingDoc | null): PriceTable<PaidTier> {
    return { top: knownPrices(kind, 'top', pricing), pro: knownPrices(kind, 'pro', pricing) };
}

/** Price ID → แพลนเสียเงิน · ไม่รู้จัก = null (ห้ามให้แพลน ให้ log ลง billingAlerts) */
export function paidTierForPrice(kind: ProviderKind, priceId: string | null | undefined, pricing: PlanPricingDoc | null): PaidTier | null {
    return resolvePlanFromPrice(priceTable(kind, pricing), priceId);
}

/** Price ID → แพลน — ใช้ตัดสินแพลนจาก subscription จริง (เปลี่ยนแพลนผ่าน portal ก็ถูกต้อง) · ไม่รู้จัก = free */
export function tierForPrice(kind: ProviderKind, priceId: string | null | undefined, pricing: PlanPricingDoc | null): PlanTier {
    return paidTierForPrice(kind, priceId, pricing) ?? 'free';
}

/** Billing Portal configuration ของแพลนทนายจากราคากลาง · null = ค่าเริ่มต้นของ Stripe (แบบเดิม) */
export function portalConfigFor(kind: ProviderKind, pricing: PlanPricingDoc | null): string | null {
    return kind === 'lawyer' ? pricing?.portalConfigId ?? null : null;
}
