'use server';

/**
 * แพลนรายเดือนของทนาย / ล่าม (Stripe subscription) — ดู src/lib/provider-plans.ts
 *
 * ตัวตนมาจาก session เท่านั้น (requireLawyer / requireInterpreter) ไม่รับ uid/profileId จาก client
 * ต่างจาก CapDeal ที่ใช้ users.subscription: ที่นี่สร้าง Stripe customer แยกต่อโปรไฟล์ และไม่ใส่
 * metadata.userId — webhook ของ CapDeal (บัญชี Stripe เดียวกัน) จึงข้าม event ของเรา
 */

import { headers } from 'next/headers';
import type Stripe from 'stripe';
import { requireInterpreter, requireLawyer, authErrorResult } from '@/lib/auth-guard';
import { effectiveTier, PLAN_PRODUCT, type PaidTier, type PlanTier, type ProviderKind, type StoredPlan } from '@/lib/provider-plans';
import { getStripe, priceIdFor } from '@/lib/stripe-plans';
import { planFromSubscription, planTarget, PROFILE_COLLECTION, savePlan } from '@/lib/provider-plan-sync';

type Result<T = {}> = ({ success: true } & T) | { success: false; error: string };

const LOCALES = ['th', 'en', 'zh'];

async function caller(kind: ProviderKind) {
    if (kind === 'lawyer') {
        const s = await requireLawyer();
        const snap = await s.adminApp.firestore().collection('lawyerProfiles').doc(s.lawyerProfileId).get();
        return { ...s, profileId: s.lawyerProfileId, profile: snap.data() || {} };
    }
    if (kind === 'interpreter') {
        const s = await requireInterpreter();
        return { ...s, profileId: s.interpreterId, profile: s.profile };
    }
    throw new Error('invalid kind');
}

function returnPath(kind: ProviderKind, locale: string) {
    const l = LOCALES.includes(locale) ? locale : 'th';
    return kind === 'lawyer' ? `/${l}/lawyer-dashboard/plan` : `/${l}/interpreter-dashboard?tab=plan`;
}

/** origin สำหรับ success/cancel URL — รับเฉพาะโดเมนของเรา กันการพาไปเว็บอื่นหลังจ่ายเงิน */
async function siteOrigin(): Promise<string> {
    const h = await headers();
    const host = (h.get('x-forwarded-host') || h.get('host') || '').split(',')[0].trim();
    const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'lawslane.com';
    if (host === root || host.endsWith(`.${root}`)) return `https://${host}`;
    if (process.env.NODE_ENV !== 'production' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
    return `https://www.${root}`;
}

type PriceView = { amount: number; currency: string; interval: string } | null;

export async function getMyPlanAction(kind: ProviderKind): Promise<Result<{
    tier: PlanTier;
    status: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    hasBillingAccount: boolean;
    prices: Record<PaidTier, PriceView>;
}>> {
    try {
        const { profile } = await caller(kind);
        const plan = (profile.plan || null) as StoredPlan | null;
        const stripe = getStripe();
        const prices: Record<PaidTier, PriceView> = { pro: null, top: null };
        if (stripe) {
            await Promise.all((['pro', 'top'] as PaidTier[]).map(async tier => {
                const id = priceIdFor(kind, tier);
                if (!id) return;
                try {
                    const p = await stripe.prices.retrieve(id);
                    if (p.active && typeof p.unit_amount === 'number') {
                        prices[tier] = { amount: p.unit_amount / 100, currency: p.currency, interval: p.recurring?.interval || 'month' };
                    }
                } catch (e) {
                    console.error('price retrieve failed', tier, e);
                }
            }));
        }
        return {
            success: true,
            tier: effectiveTier(plan),
            status: plan?.status || null,
            currentPeriodEnd: plan?.currentPeriodEnd || null,
            cancelAtPeriodEnd: plan?.cancelAtPeriodEnd === true,
            hasBillingAccount: !!plan?.customerId,
            prices,
        };
    } catch (e) {
        return authErrorResult(e);
    }
}

export async function startPlanCheckoutAction(kind: ProviderKind, tier: PaidTier, locale: string): Promise<Result<{ url: string }>> {
    try {
        const { adminApp, profileId, profile, token } = await caller(kind);
        if (kind === 'lawyer' && profile.status !== 'approved') {
            return { success: false, error: 'บัญชีทนายต้องผ่านการอนุมัติก่อนสมัครแพลน' };
        }
        if (tier !== 'pro' && tier !== 'top') return { success: false, error: 'แพลนไม่ถูกต้อง' };
        const stripe = getStripe();
        const priceId = priceIdFor(kind, tier);
        if (!stripe || !priceId) return { success: false, error: 'ยังไม่เปิดให้สมัครแพลนนี้' };

        const db = adminApp.firestore();
        const ref = db.collection(PROFILE_COLLECTION[kind]).doc(profileId);
        const plan = (profile.plan || null) as StoredPlan | null;

        // มีแพลนเสียเงินอยู่แล้ว → เปลี่ยน/ยกเลิกผ่าน billing portal (กันการสมัครซ้อนสอง subscription)
        if (plan?.subscriptionId && effectiveTier(plan) !== 'free') {
            return { success: false, error: 'คุณมีแพลนอยู่แล้ว กด "จัดการการชำระเงิน" เพื่อเปลี่ยนหรือยกเลิกแพลน' };
        }

        const metadata = { product: PLAN_PRODUCT[kind], profileId };
        let customerId = plan?.customerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: token.email || profile.email || undefined,
                name: profile.name || undefined,
                metadata,
            });
            customerId = customer.id;
            const initial: StoredPlan = { tier: 'free', status: 'none', currentPeriodEnd: null, customerId, subscriptionId: null, updatedAt: new Date().toISOString() };
            await ref.update({ plan: initial });
        }

        const origin = await siteOrigin();
        const back = returnPath(kind, locale);
        const sep = back.includes('?') ? '&' : '?';
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            client_reference_id: profileId,
            metadata,
            subscription_data: { metadata },
            allow_promotion_codes: true,
            success_url: `${origin}${back}${sep}checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}${back}${sep}checkout=cancel`,
        });
        if (!session.url) return { success: false, error: 'สร้างหน้าชำระเงินไม่สำเร็จ' };
        return { success: true, url: session.url };
    } catch (e) {
        console.error('startPlanCheckoutAction', e);
        return authErrorResult(e);
    }
}

export async function openPlanPortalAction(kind: ProviderKind, locale: string): Promise<Result<{ url: string }>> {
    try {
        const { profile } = await caller(kind);
        const customerId = (profile.plan as StoredPlan | undefined)?.customerId;
        const stripe = getStripe();
        if (!stripe || !customerId) return { success: false, error: 'ยังไม่มีบัญชีการชำระเงิน' };
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${await siteOrigin()}${returnPath(kind, locale)}`,
        });
        return { success: true, url: session.url };
    } catch (e) {
        console.error('openPlanPortalAction', e);
        return authErrorResult(e);
    }
}

/**
 * กลับมาจากหน้าชำระเงิน → อ่าน subscription จาก Stripe แล้วบันทึกทันที ไม่ต้องรอ webhook
 * session ต้องเป็นของโปรไฟล์ผู้เรียกเท่านั้น
 */
export async function syncPlanFromCheckoutAction(kind: ProviderKind, sessionId: string): Promise<Result<{ tier: PlanTier }>> {
    try {
        const { adminApp, profileId } = await caller(kind);
        const stripe = getStripe();
        if (!stripe || typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) return { success: false, error: 'ข้อมูลไม่ถูกต้อง' };
        const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
        const target = planTarget(session.metadata);
        if (!target || target.kind !== kind || target.profileId !== profileId) return { success: false, error: 'ไม่พบรายการชำระเงินนี้' };
        const sub = session.subscription as Stripe.Subscription | null;
        if (!sub || typeof sub === 'string') return { success: false, error: 'การชำระเงินยังไม่เสร็จ' };
        const plan = planFromSubscription(kind, sub);
        await savePlan(adminApp.firestore(), kind, profileId, plan);
        return { success: true, tier: effectiveTier(plan) };
    } catch (e) {
        console.error('syncPlanFromCheckoutAction', e);
        return authErrorResult(e);
    }
}
