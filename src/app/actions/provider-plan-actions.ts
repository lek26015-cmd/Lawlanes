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
import { effectiveTier, grantTier, lawyerTier, LIVE_STATUSES, PLAN_PRODUCT, type PaidTier, type PlanTier, type ProviderKind, type StoredPlan } from '@/lib/provider-plans';
import { getStripe, priceIdFor } from '@/lib/stripe-plans';
import { planFromSubscription, planTarget, PROFILE_COLLECTION, savePlan } from '@/lib/provider-plan-sync';
import { checkRateLimit } from '@/lib/security/rate-limiter';

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

/** cache ราคาจาก Stripe 60 วินาที (ต่อ instance) — หน้าแพลนไม่ต้องเรียก prices.retrieve ทุกครั้งที่เปิด */
const PRICE_CACHE_MS = 60 * 1000;
const priceCache = new Map<string, { at: number; view: PriceView }>();

async function priceView(stripe: Stripe, id: string): Promise<PriceView> {
    const hit = priceCache.get(id);
    if (hit && Date.now() - hit.at < PRICE_CACHE_MS) return hit.view;
    const p = await stripe.prices.retrieve(id);
    const view = p.active && typeof p.unit_amount === 'number'
        ? { amount: p.unit_amount / 100, currency: p.currency, interval: p.recurring?.interval || 'month' }
        : null;
    priceCache.set(id, { at: Date.now(), view });
    return view;
}

/** จำกัดการสร้างหน้าชำระเงิน 5 ครั้ง / 10 นาที ต่อโปรไฟล์ (กันการสุ่มทดลองบัตร — หลักความปลอดภัยข้อ 11) */
const CHECKOUT_LIMIT = 5;
const CHECKOUT_WINDOW_MS = 10 * 60 * 1000;

/** การกดสมัครซ้ำแพลนเดิมภายในช่วงนี้ใช้ idempotency key เดิม → Stripe คืน Checkout Session เดิม */
const CHECKOUT_REUSE_MS = 10 * 60 * 1000;

export async function getMyPlanAction(kind: ProviderKind): Promise<Result<{
    tier: PlanTier;
    /** แพลนที่แอดมินมอบ (ทนายเท่านั้น) — tier ด้านบนคือที่สูงกว่าระหว่าง Stripe กับที่มอบ */
    grant: { tier: PlanTier; expiresAt: string | null } | null;
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
                    prices[tier] = await priceView(stripe, id);
                } catch (e) {
                    console.error('price retrieve failed', tier, e);
                }
            }));
        }
        const granted = kind === 'lawyer' ? grantTier(profile.planGrant) : 'free';
        const exp = profile.planGrant?.expiresAt;
        return {
            success: true,
            tier: kind === 'lawyer' ? lawyerTier(profile) : effectiveTier(plan),
            grant: granted !== 'free'
                ? { tier: granted, expiresAt: exp?.toDate ? exp.toDate().toISOString() : (typeof exp === 'string' ? exp : null) }
                : null,
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

export async function startPlanCheckoutAction(kind: ProviderKind, tier: PaidTier, locale: string, acceptedTerms?: boolean): Promise<Result<{ url: string }>> {
    try {
        // เลิกขายแพลนล่ามแล้ว (ไม่แสดงรายชื่อล่ามบนเว็บ ป้ายแนะนำ/อันดับจึงไม่มีผล) — portal ยังเปิดให้จัดการของเดิมได้
        if (kind === 'interpreter') return { success: false, error: 'ไม่มีแพลนรายเดือนสำหรับล่ามแล้ว' };
        const { adminApp, profileId, profile, token } = await caller(kind);
        if (kind === 'lawyer' && profile.status !== 'approved') {
            return { success: false, error: 'บัญชีทนายต้องผ่านการอนุมัติก่อนสมัครแพลน' };
        }
        if (tier !== 'pro' && tier !== 'top') return { success: false, error: 'แพลนไม่ถูกต้อง' };
        // แพลนต่ออายุอัตโนมัติ — ต้องยอมรับข้อกำหนด (หมวดแพลนรายเดือน) ก่อนไปหน้าชำระเงิน
        if (acceptedTerms !== true) return { success: false, error: 'กรุณายอมรับข้อกำหนดการใช้งานก่อนสมัครแพลน' };
        const stripe = getStripe();
        const priceId = priceIdFor(kind, tier);
        if (!stripe || !priceId) return { success: false, error: 'ยังไม่เปิดให้สมัครแพลนนี้' };

        const db = adminApp.firestore();
        const ref = db.collection(PROFILE_COLLECTION[kind]).doc(profileId);
        const plan = (profile.plan || null) as StoredPlan | null;

        // มี subscription ที่ยังมีผลอยู่แล้ว (รวม past_due ที่เกิน 3 วัน) → เปลี่ยน/ยกเลิกผ่าน billing portal
        // (กันการสมัครซ้อนสอง subscription)
        const hasPlanMsg = 'คุณมีแพลนอยู่แล้ว กด "จัดการการชำระเงิน" เพื่อเปลี่ยนหรือยกเลิกแพลน';
        if (plan?.subscriptionId && (LIVE_STATUSES.includes(plan.status) || effectiveTier(plan) !== 'free')) {
            return { success: false, error: hasPlanMsg };
        }

        const limit = await checkRateLimit(`plan-checkout:${kind}:${profileId}`, CHECKOUT_LIMIT, CHECKOUT_WINDOW_MS);
        if (!limit.success) return { success: false, error: 'สร้างหน้าชำระเงินบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' };

        const l = LOCALES.includes(locale) ? locale : 'th';
        // จองการกดสมัคร: กดซ้ำแพลนเดิมภายใน 10 นาทีใช้เวลา/คีย์เดิม → พารามิเตอร์เหมือนเดิม Stripe คืน session เดิม
        const attemptRef = db.collection('providerPlanCheckouts').doc(`${kind}_${profileId}`);
        const termsAcceptedAt = await db.runTransaction(async tx => {
            const prev = (await tx.get(attemptRef)).data() as { tier?: string; locale?: string; termsAcceptedAt?: string; at?: number } | undefined;
            if (prev?.termsAcceptedAt && prev.tier === tier && prev.locale === l && Date.now() - Number(prev.at || 0) < CHECKOUT_REUSE_MS) {
                return prev.termsAcceptedAt;
            }
            const at = Date.now();
            const fresh = new Date(at).toISOString();
            tx.set(attemptRef, { tier, locale: l, termsAcceptedAt: fresh, at });
            return fresh;
        });
        const metadata = { product: PLAN_PRODUCT[kind], profileId, terms_accepted_at: termsAcceptedAt };
        await ref.update({ planTermsAcceptedAt: termsAcceptedAt });

        let customerId = plan?.customerId;
        if (!customerId) {
            // metadata ของ customer ไม่ใส่เวลา (คงที่) — idempotency key เดียวกันต้องส่งพารามิเตอร์เหมือนเดิม
            const customer = await stripe.customers.create({
                email: token.email || profile.email || undefined,
                name: profile.name || undefined,
                metadata: { product: PLAN_PRODUCT[kind], profileId },
            }, { idempotencyKey: `lawslane-plan-customer:${kind}:${profileId}` });
            customerId = customer.id;
            const initial: StoredPlan = { tier: 'free', status: 'none', currentPeriodEnd: null, customerId, subscriptionId: null, updatedAt: new Date().toISOString() };
            await ref.update({ plan: initial });
        } else {
            // ถามสถานะจริงจาก Stripe ด้วย — จ่ายแล้วแต่ webhook ยังไม่มา โปรไฟล์ยังไม่รู้
            const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
            if (subs.data.some(sub => planTarget(sub.metadata) && LIVE_STATUSES.includes(sub.status))) {
                return { success: false, error: hasPlanMsg };
            }
        }

        // Checkout ที่ยัง open ของโปรไฟล์นี้: แพลนเดียวกัน → ใช้อันเดิม · คนละแพลน → ปิดทิ้ง (กันจ่ายสองใบ)
        const open = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 10, expand: ['data.line_items'] });
        for (const cs of open.data) {
            const t = planTarget(cs.metadata);
            if (!t || t.kind !== kind || t.profileId !== profileId) continue;
            if (cs.url && cs.line_items?.data?.[0]?.price?.id === priceId) return { success: true, url: cs.url };
            await stripe.checkout.sessions.expire(cs.id);
        }

        const origin = await siteOrigin();
        const back = returnPath(kind, l);
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
        }, { idempotencyKey: `lawslane-plan-checkout:${kind}:${profileId}:${tier}:${termsAcceptedAt}:${origin}${back}` });
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
        // กดซ้ำภายในนาทีเดียวกันได้ session เดิม (portal session อายุสั้น ไม่ต้องจองนานกว่านี้)
        const minute = Math.floor(Date.now() / 60000);
        const returnUrl = `${await siteOrigin()}${returnPath(kind, locale)}`;
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        }, { idempotencyKey: `lawslane-plan-portal:${customerId}:${minute}:${returnUrl}` });
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

/** ป้ายแพลนบน sidebar หลังบ้านทนาย — อ่านแค่โปรไฟล์ ไม่เรียก Stripe (ถูกเรียกทุกหน้า) */
export async function getMyLawyerPlanBadgeAction(): Promise<{ tier: PlanTier; granted: boolean } | null> {
    try {
        const { profile } = await caller('lawyer');
        const tier = lawyerTier(profile);
        return { tier, granted: tier !== 'free' && grantTier(profile.planGrant) === tier && effectiveTier(profile.plan) !== tier };
    } catch {
        return null;
    }
}
