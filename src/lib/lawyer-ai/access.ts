import 'server-only';

import { initAdmin } from '@/lib/firebase-admin';
import { requireUser } from '@/lib/auth-guard';
import { checkLawyerFeature, type LockedStatus } from '@/lib/lawyer-plan-access';
import { customerGrantPlan, mergeCustomerAiPlans, type CustomerAiPlan } from '@/lib/customer-ai-plan';
import type { AiAudience } from '@/lib/lawyer-ai/types';

/**
 * ใครใช้ผู้ช่วย AI ได้ และได้เครดิตรายเดือนเท่าไร — ตัดสินที่ server จาก audience ที่หน้าส่งมา
 *   - lawyer:   ต้องเป็นทนายที่แพลนมีสิทธิ์ aiAssistant · เครดิตตามแพลนทนาย · ใช้แฟ้มคดีได้
 *   - customer: ผู้ใช้ที่ล็อกอินแล้วทุกคน (รวมทนาย) · เครดิตตามแพ็กเกจลูกค้า · ไม่มีแฟ้มคดี
 */
export type AiAccess =
    | { status: 'ok'; audience: AiAudience; uid: string; db: FirebaseFirestore.Firestore; monthlyCredits: number | null; canUseCases: boolean; customerPlan?: CustomerAiPlan }
    | { status: LockedStatus };

const CONFIG_TTL_MS = 60_000;
let customerConfig: { at: number; value: ReturnType<typeof mergeCustomerAiPlans> } | null = null;

async function getCustomerConfig(db: FirebaseFirestore.Firestore) {
    if (customerConfig && Date.now() - customerConfig.at < CONFIG_TTL_MS) return customerConfig.value;
    let stored: unknown = null;
    try {
        stored = (await db.collection('planEntitlements').doc('lawslane').get()).get('plans');
    } catch (e) {
        console.error('[ai] read planEntitlements/lawslane failed:', e instanceof Error ? e.message : e);
    }
    const value = mergeCustomerAiPlans(stored);
    customerConfig = { at: Date.now(), value };
    return value;
}

export function parseAudience(v: unknown): AiAudience {
    return v === 'lawyer' ? 'lawyer' : 'customer';
}

export async function getAiAccess(audience: AiAudience): Promise<AiAccess> {
    if (audience === 'lawyer') {
        const ctx = await checkLawyerFeature('aiAssistant');
        if (ctx.status !== 'ok') return ctx;
        return { status: 'ok', audience, uid: ctx.uid, db: ctx.db, monthlyCredits: ctx.entitlements.aiCreditsPerMonth, canUseCases: true };
    }
    let uid: string;
    try {
        ({ uid } = await requireUser());
    } catch {
        return { status: 'unauthenticated' };
    }
    const adminApp = await initAdmin();
    if (!adminApp) return { status: 'unauthenticated' };
    const db = adminApp.firestore();
    const [config, userSnap] = await Promise.all([getCustomerConfig(db), db.collection('users').doc(uid).get()]);
    const plan = customerGrantPlan(userSnap.get('planGrants')?.lawslane);
    return { status: 'ok', audience, uid, db, monthlyCredits: config[plan].aiCreditsPerMonth, canUseCases: false, customerPlan: plan };
}
