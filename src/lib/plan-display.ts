import type { PlanTier } from '@/lib/provider-plans';
import type { CustomerAiPlan } from '@/lib/customer-ai-plan';
import type { PlanTone } from '@/components/plan-avatar';

/** แพลนที่แสดงบนรูปโปรไฟล์ — ทนายใช้ lawyerTier() ลูกค้าใช้ customerGrantPlan() */
export type UserPlan = PlanTier | CustomerAiPlan;

const DISPLAY: Record<UserPlan, { tone: PlanTone; label: string }> = {
    free: { tone: 'none', label: 'ฟรี' },
    plus: { tone: 'plus', label: 'Plus' },
    pro: { tone: 'gold', label: 'Pro' },
    top: { tone: 'premium', label: 'บริษัท' },
};

export function userPlanDisplay(plan: UserPlan) {
    return DISPLAY[plan];
}
