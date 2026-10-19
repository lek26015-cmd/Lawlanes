import 'server-only';

import { requireLawyer, requireUser, AuthError } from '@/lib/auth-guard';
import { lawyerTier, type PlanTier } from '@/lib/provider-plans';
import { mergeLawyerEntitlements, type LawyerEntitlements, type LawyerFeature } from '@/lib/lawyer-entitlements';

/**
 * ฟีเจอร์หลังบ้านทนายที่ขึ้นกับแพลน — ดูรายการใน lib/lawyer-entitlements.ts
 * แพลนที่ใช้ = ที่สูงกว่าระหว่าง Stripe กับที่แอดมินมอบ (lawyerTier) · สิทธิ์ของแต่ละแพลนแอดมินปรับได้
 *
 * ยกเว้นโดยตั้งใจ: การปิดเคส/ยกเลิกเคสที่ลูกความจ้างผ่านแชท (closeCaseAction, cancelCaseAction)
 * ทนายทุกแพลนยังต้องทำได้ ไม่งั้นเคสของลูกความค้าง
 *
 * เช็คที่ server ทุกครั้ง — ล็อกหน้า/ซ่อนเมนูอย่างเดียวไม่พอ เพราะ server action ยิงตรงได้
 * อ่าน plan จากโปรไฟล์ทุกครั้ง (ไม่เก็บใน claim) เพราะแพลนหมดอายุ/ยกเลิกได้ระหว่างที่ session ยังอยู่
 * ไม่มีสิทธิ์แล้ว = ข้อมูลเดิมถูกซ่อน (ไม่ลบ) จนกว่าจะได้สิทธิ์กลับ
 */

type Db = FirebaseFirestore.Firestore;

// planEntitlements/lawyer แทบไม่เปลี่ยน แต่ถูกอ่านทุก request ของหลังบ้าน — cache ในหน่วยความจำสั้น ๆ
const CONFIG_TTL_MS = 60_000;
let configCache: { at: number; value: Record<PlanTier, LawyerEntitlements> } | null = null;

export async function getLawyerPlanConfig(db: Db): Promise<Record<PlanTier, LawyerEntitlements>> {
    if (configCache && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.value;
    let stored: unknown = null;
    try {
        stored = (await db.collection('planEntitlements').doc('lawyer').get()).get('plans');
    } catch (e) {
        // อ่านไม่ได้ให้ใช้ค่าเริ่มต้น (เท่าพฤติกรรมก่อนมีหน้าตั้งค่า) ดีกว่าล็อกทนายทุกคน
        console.error('[lawyer-plan] read planEntitlements/lawyer failed:', e instanceof Error ? e.message : e);
    }
    const value = mergeLawyerEntitlements(stored);
    configCache = { at: Date.now(), value };
    return value;
}

export type LockedStatus = 'unauthenticated' | 'not-lawyer' | 'upgrade-required';

export type LawyerPlanContext = {
    uid: string;
    lawyerProfileId: string;
    tier: PlanTier;
    entitlements: LawyerEntitlements;
    db: Db;
};

export async function getLawyerPlanContext(): Promise<({ status: 'ok' } & LawyerPlanContext) | { status: Exclude<LockedStatus, 'upgrade-required'> }> {
    let session: Awaited<ReturnType<typeof requireLawyer>>;
    try {
        session = await requireLawyer();
    } catch (e) {
        return { status: e instanceof AuthError && e.status === 403 ? 'not-lawyer' : 'unauthenticated' };
    }
    const db = session.adminApp.firestore();
    const [profile, config] = await Promise.all([
        db.collection('lawyerProfiles').doc(session.lawyerProfileId).get(),
        getLawyerPlanConfig(db),
    ]);
    const tier = lawyerTier(profile.data());
    return { status: 'ok', uid: session.uid, lawyerProfileId: session.lawyerProfileId, tier, entitlements: config[tier], db };
}

export async function checkLawyerFeature(feature: LawyerFeature): Promise<({ status: 'ok' } & LawyerPlanContext) | { status: LockedStatus }> {
    const ctx = await getLawyerPlanContext();
    if (ctx.status !== 'ok') return ctx;
    if (!ctx.entitlements[feature]) return { status: 'upgrade-required' };
    return ctx;
}

/** สำหรับ action แบบ throw — ผ่านได้เฉพาะทนายที่แพลนมีสิทธิ์นี้ หรือแอดมิน */
export async function requireLawyerFeature(feature: LawyerFeature) {
    const session = await requireUser();
    if (session.token.admin === true || session.token.role === 'admin') return session;
    const access = await checkLawyerFeature(feature);
    if (access.status === 'upgrade-required') throw new AuthError('Upgrade required: plan does not include this feature', 402);
    if (access.status !== 'ok') throw new AuthError('Forbidden: lawyer access required', 403);
    return session;
}
