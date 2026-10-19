/**
 * แพ็กเกจ AI ของลูกค้าทั่วไป (หน้า /ai แทนลลิน) — แอดมินตั้งได้ที่หลังบ้าน /customers/plans
 *   - `planEntitlements/lawslane`          { plans: { free|plus: { aiCreditsPerMonth } } } · ไม่มีเอกสาร = ค่าเริ่มต้นด้านล่าง
 *   - `users/{uid}.planGrants.lawslane`    { planId, expiresAt|null, grantedAt } — แอดมินมอบรายคน (แบบเดียวกับ CapDeal/Wittaya)
 *
 * ⚠️ คีย์และค่าเริ่มต้นต้องตรงกับ lawslane-admin/src/lib/plan-entitlements.ts (PLAN_CATALOG.lawslane)
 * ยังไม่มีการจ่ายเงิน — ในอนาคตซื้อเครดิตเพิ่มเข้ากระเป๋า extra ได้ (ดู lib/lawyer-ai/credits.ts)
 * import ได้ทั้ง client และ server
 */

export type CustomerAiPlan = 'free' | 'plus';

export const CUSTOMER_AI_DEFAULTS: Record<CustomerAiPlan, { aiCreditsPerMonth: number | null }> = {
    free: { aiCreditsPerMonth: 20 },
    plus: { aiCreditsPerMonth: 200 },
};

export function mergeCustomerAiPlans(stored: unknown): Record<CustomerAiPlan, { aiCreditsPerMonth: number | null }> {
    const src = (stored ?? {}) as Record<string, Record<string, unknown>>;
    const out = { free: { ...CUSTOMER_AI_DEFAULTS.free }, plus: { ...CUSTOMER_AI_DEFAULTS.plus } };
    for (const plan of ['free', 'plus'] as CustomerAiPlan[]) {
        const n = src[plan]?.aiCreditsPerMonth;
        if (n === null || (typeof n === 'number' && Number.isInteger(n) && n >= 0)) out[plan].aiCreditsPerMonth = n as number | null;
    }
    return out;
}

/** แพ็กเกจที่แอดมินมอบ ถ้ายังไม่หมดอายุ */
export function customerGrantPlan(grant: unknown, now = Date.now()): CustomerAiPlan {
    const g = grant as { planId?: unknown; expiresAt?: { toMillis?: () => number } | null } | null | undefined;
    if (g?.planId !== 'plus') return 'free';
    const exp = g.expiresAt?.toMillis?.();
    if (typeof exp === 'number' && exp <= now) return 'free';
    return 'plus';
}
