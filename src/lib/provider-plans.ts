/**
 * แพลนรายเดือนของผู้ให้บริการ (ทนาย / ล่าม) — ชุดเดียวใช้ทั้งสองแบบ
 *
 * ข้อมูลเก็บบนโปรไฟล์ของแต่ละแบบ (`lawyerProfiles.plan`, `interpreterProfiles.plan`) ไม่ใช่ `users`
 * เพราะ `users.subscription` เป็นของ CapDeal (บัญชี Stripe เดียวกัน) — ดู LAWSLANE-PLAN-02 A.1
 * `plan` เขียนได้จาก server (Admin SDK) เท่านั้น: rules ของ lawyerProfiles ให้ทนายแก้เฉพาะ
 * ownerEditableLawyerFields() และ interpreterProfiles เขียนได้เฉพาะแอดมิน
 *
 * ไฟล์นี้ import ได้ทั้ง client และ server (ไม่มี Stripe / Admin SDK)
 */

export type ProviderKind = 'lawyer' | 'interpreter';
export type PlanTier = 'free' | 'pro' | 'top';
export type PaidTier = Exclude<PlanTier, 'free'>;

/** metadata.product บน Checkout Session / Subscription — webhook ข้าม event ที่ไม่ใช่ของเรา (เช่น CapDeal) */
export const PLAN_PRODUCT: Record<ProviderKind, string> = {
    lawyer: 'lawyer_plan',
    interpreter: 'interpreter_plan',
};

export type StoredPlan = {
    tier: PlanTier;
    /** สถานะจาก Stripe: active | trialing | past_due | canceled | unpaid | incomplete | ... */
    status: string;
    /** ISO — สิ้นรอบบิลปัจจุบัน */
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd?: boolean;
    customerId: string;
    subscriptionId: string | null;
    priceId?: string | null;
    updatedAt?: string;
};

const ACTIVE_STATUSES = ['active', 'trialing'];

/** แพลนที่ใช้สิทธิ์ได้จริงตอนนี้ — ไม่ active หรือเลยรอบบิลแล้ว = free */
export function effectiveTier(plan: unknown, now: Date = new Date()): PlanTier {
    const p = plan as Partial<StoredPlan> | null | undefined;
    if (!p || (p.tier !== 'pro' && p.tier !== 'top')) return 'free';
    if (!ACTIVE_STATUSES.includes(String(p.status))) return 'free';
    if (p.currentPeriodEnd) {
        const end = new Date(p.currentPeriodEnd).getTime();
        // เผื่อ 2 วันให้ Stripe ต่ออายุ/ส่ง webhook ทัน
        if (Number.isFinite(end) && end + 2 * 24 * 60 * 60 * 1000 < now.getTime()) return 'free';
    }
    return p.tier;
}

export const TIER_RANK: Record<PlanTier, number> = { free: 0, pro: 1, top: 2 };

/**
 * แพลนที่แอดมินมอบให้ทนาย (หลังบ้าน /lawyer-plans) — `lawyerProfiles.planGrant`
 * { tier, expiresAt: Timestamp|null, grantedAt } · เขียนได้จาก Admin SDK เท่านั้น (ไม่อยู่ใน ownerEditableLawyerFields)
 * หมายเหตุ/ผู้มอบอยู่ที่ `planGrantRecords/lawyer_{profileId}` · โครงนี้ต้องตรงกับ lawslane-admin/src/lib/plan-entitlements.ts
 */
export function grantTier(grant: unknown, now: Date = new Date()): PlanTier {
    const g = grant as { tier?: unknown; expiresAt?: unknown } | null | undefined;
    if (!g || (g.tier !== 'pro' && g.tier !== 'top')) return 'free';
    const exp = g.expiresAt as { toMillis?: () => number; _seconds?: number; seconds?: number } | string | null | undefined;
    if (exp) {
        const ms = typeof exp === 'string' ? new Date(exp).getTime()
            : typeof exp.toMillis === 'function' ? exp.toMillis()
            : typeof exp._seconds === 'number' ? exp._seconds * 1000
            : typeof exp.seconds === 'number' ? exp.seconds * 1000
            : NaN;
        if (!Number.isFinite(ms) || ms <= now.getTime()) return 'free';
    }
    return g.tier;
}

/** แพลนที่ใช้จริงของทนาย = ที่สูงกว่าระหว่าง Stripe (`plan`) กับที่แอดมินมอบ (`planGrant`) */
export function lawyerTier(profile: { plan?: unknown; planGrant?: unknown } | null | undefined, now: Date = new Date()): PlanTier {
    const paid = effectiveTier(profile?.plan, now);
    const granted = grantTier(profile?.planGrant, now);
    return TIER_RANK[granted] > TIER_RANK[paid] ? granted : paid;
}

/** เรียงให้แพลนสูงขึ้นก่อน แล้วคงลำดับเดิมภายในกลุ่ม */
export function sortByTier<T extends { planTier?: PlanTier }>(list: T[]): T[] {
    return list
        .map((item, i) => ({ item, i }))
        .sort((a, b) => TIER_RANK[b.item.planTier || 'free'] - TIER_RANK[a.item.planTier || 'free'] || a.i - b.i)
        .map(x => x.item);
}

/** ชื่อและสิทธิ์ของแต่ละแพลน (แสดงในหน้าเลือกแพลน) — ราคาอ่านจาก Stripe ไม่เขียนในโค้ด */
export const PLAN_INFO: Record<ProviderKind, Record<PlanTier, { name: [string, string]; perks: [string, string][] }>> = {
    lawyer: {
        free: {
            name: ['ฟรี', 'Free'],
            perks: [['โปรไฟล์ในรายชื่อทนาย', 'Listed in the lawyer directory'], ['แชทกับลูกความไม่จำกัด', 'Unlimited client chat']],
        },
        pro: {
            name: ['Pro', 'Pro'],
            perks: [
                ['ป้าย "ทนายแนะนำ" และกรอบรูปสีทอง', '"Recommended" badge and gold photo ring'],
                ['ขึ้นก่อนทนายแพลนฟรีในรายชื่อ', 'Listed above Free-plan lawyers'],
                ['หน้าเว็บส่วนตัว lawslane.com/p/ชื่อของคุณ', 'Personal page at lawslane.com/p/your-name'],
                ['ระบบจัดการคดีและใบแจ้งหนี้', 'Case management and invoicing'],
                ['ผู้ช่วย AI งานคดี: ค้นมาตรา/ฎีกา ร่างเอกสาร ตรวจสัญญา', 'AI case assistant: statutes, judgments, drafting and contract review'],
            ],
        },
        top: {
            name: ['บริษัท', 'Firm'],
            perks: [
                ['การ์ดกรอบทองขนาดใหญ่ อยู่บนสุดของหน้าแรกและรายชื่อทนาย', 'Large gold-framed card at the top of the home page and directory'],
                ['ป้าย "ทนายแนะนำ"', '"Recommended" badge'],
                ['หน้าเว็บส่วนตัว lawslane.com/p/ชื่อของคุณ', 'Personal page at lawslane.com/p/your-name'],
                ['ระบบจัดการคดีและใบแจ้งหนี้', 'Case management and invoicing'],
                ['ผู้ช่วย AI งานคดี: ค้นมาตรา/ฎีกา ร่างเอกสาร ตรวจสัญญา', 'AI case assistant: statutes, judgments, drafting and contract review'],
            ],
        },
    },
    interpreter: {
        free: {
            name: ['ฟรี', 'Free'],
            perks: [['โปรไฟล์ในรายชื่อล่าม', 'Listed in the interpreter directory'], ['รับงานและแชทกับลูกค้า', 'Receive jobs and chat with clients']],
        },
        pro: {
            name: ['Pro', 'Pro'],
            perks: [
                ['ป้าย "ล่ามแนะนำ" และกรอบรูปสีทอง', '"Recommended" badge and gold photo ring'],
                ['ขึ้นก่อนล่ามแพลนฟรีในรายชื่อ', 'Listed above Free-plan interpreters'],
            ],
        },
        top: {
            name: ['พรีเมียม', 'Premium'],
            perks: [
                ['การ์ดกรอบทอง อยู่บนสุดของหน้าแรกและรายชื่อล่าม', 'Gold-framed card at the top of the home page and directory'],
                ['ป้าย "ล่ามแนะนำ"', '"Recommended" badge'],
            ],
        },
    },
};

/**
 * ทนายที่เคยฟิกชื่อไว้ในโค้ดให้เป็นการ์ดกรอบทอง (ก่อนมีระบบแพลน) — คงไว้ไม่ให้หน้าเปลี่ยนทันที
 * ย้ายเข้าแพลนจริงแล้ว (ให้แพลนผ่านแอดมิน หรือทนายสมัครเอง) ให้ลบรายชื่อออก
 */
const LEGACY_TOP_LAWYER_NAMES = ['กฤตเมธ ไวโส'];

/** แพลนที่ใช้แสดงผลของทนาย (รวมรายชื่อเดิม) */
export function lawyerDisplayTier(l: { planTier?: PlanTier; name?: string }): PlanTier {
    if (l.planTier === 'top' || LEGACY_TOP_LAWYER_NAMES.some(n => l.name?.includes(n))) return 'top';
    return l.planTier || 'free';
}
