/**
 * สิทธิ์ของแต่ละแพลนทนาย — แอดมินปรับได้ที่หลังบ้าน (/lawyer-plans) เก็บใน `planEntitlements/lawyer`
 * { plans: { free|pro|top: { ...สิทธิ์ } } } · ไม่มีเอกสาร = ค่าเริ่มต้นด้านล่าง
 *
 * ⚠️ คีย์และค่าเริ่มต้นต้องตรงกับ lawslane-admin/src/lib/plan-entitlements.ts (PLAN_CATALOG.lawyer)
 *
 * ป้ายทนายแนะนำ / ลำดับในรายชื่อ / การ์ดกรอบทอง ผูกกับระดับแพลน (tier) โดยตรง ไม่ได้อยู่ในนี้
 * ไฟล์นี้ import ได้ทั้ง client และ server (การอ่าน Firestore อยู่ที่ lawyer-plan-access.ts)
 */

import type { PlanTier } from '@/lib/provider-plans';

export type LawyerEntitlements = {
    /** จัดการคดี: แฟ้มคดี, pipeline, พยานหลักฐาน, ขั้นตอนงาน (การปิดเคสจากแชทใช้ได้ทุกแพลนเสมอ) */
    caseManagement: boolean;
    /** ออก/ดูใบแจ้งหนี้ในหลังบ้าน */
    invoices: boolean;
    /** ผู้ช่วย AI งานคดี */
    aiAssistant: boolean;
    /** เครดิต AI ต่อเดือน (เดือนปฏิทินเวลาไทย) — null = ไม่จำกัด · ค่าต่องานดู AI_CREDIT_COST */
    aiCreditsPerMonth: number | null;
    /** เผยแพร่หน้าเว็บส่วนตัว lawslane.com/p/... */
    personalSite: boolean;
};

export type LawyerFeature = 'caseManagement' | 'invoices' | 'aiAssistant' | 'personalSite';

export const LAWYER_ENTITLEMENT_DEFAULTS: Record<PlanTier, LawyerEntitlements> = {
    free: { caseManagement: false, invoices: false, aiAssistant: false, aiCreditsPerMonth: 0, personalSite: false },
    pro: { caseManagement: true, invoices: true, aiAssistant: true, aiCreditsPerMonth: 300, personalSite: true },
    top: { caseManagement: true, invoices: true, aiAssistant: true, aiCreditsPerMonth: 1000, personalSite: true },
};

/**
 * เครดิตที่ใช้ต่องาน — ตามต้นทุน AI คร่าว ๆ (ร่างเอกสาร/ตรวจสัญญาคำตอบยาวกว่า, อ่านไฟล์ด้วย AI คือ OCR ทั้งไฟล์)
 * เปลี่ยนค่าตรงนี้ได้เลย เครดิตที่ใช้ไปแล้วถูกบันทึกเป็นตัวเลขใน ledger ไม่ย้อนคิดใหม่
 */
export const AI_CREDIT_COST = {
    ask: 1,
    statute: 1,
    judgment: 1,
    draft: 2,
    contract: 2,
    /** ไฟล์ PDF/รูปที่ต้องให้ AI อ่าน (.txt ไม่คิดเครดิต) */
    attachment: 1,
} as const;

/** สถานะเครดิตที่ส่งให้หน้าจอ — remaining null = ไม่จำกัด */
export type AiCreditStatus = {
    period: string;
    monthly: number | null;
    monthlyUsed: number;
    /** เครดิตที่ซื้อ/ได้เพิ่ม ไม่รีเซ็ตรายเดือน (ยังไม่มีระบบซื้อ — โครงรองรับไว้แล้ว) */
    extra: number;
    remaining: number | null;
};

export const LAWYER_FEATURE_LABEL: Record<LawyerFeature, string> = {
    caseManagement: 'จัดการคดี',
    invoices: 'ใบแจ้งหนี้',
    aiAssistant: 'ผู้ช่วย AI งานคดี',
    personalSite: 'หน้าเว็บส่วนตัว',
};

export const PLAN_TIER_NAME: Record<PlanTier, string> = { free: 'ฟรี', pro: 'Pro', top: 'บริษัท' };

/** ค่าที่ใช้จริง = ค่าที่แอดมินบันทึกทับค่าเริ่มต้น (ฟิลด์ที่ไม่มี/ผิดชนิดใช้ค่าเริ่มต้น) */
export function mergeLawyerEntitlements(stored: unknown): Record<PlanTier, LawyerEntitlements> {
    const src = (stored ?? {}) as Record<string, Record<string, unknown>>;
    const out = {} as Record<PlanTier, LawyerEntitlements>;
    for (const tier of ['free', 'pro', 'top'] as PlanTier[]) {
        const v = { ...LAWYER_ENTITLEMENT_DEFAULTS[tier] };
        const s = src[tier] || {};
        for (const k of ['caseManagement', 'invoices', 'aiAssistant', 'personalSite'] as const) {
            if (typeof s[k] === 'boolean') v[k] = s[k] as boolean;
        }
        const n = s.aiCreditsPerMonth;
        if (n === null || (typeof n === 'number' && Number.isInteger(n) && n >= 0)) v.aiCreditsPerMonth = n as number | null;
        out[tier] = v;
    }
    return out;
}
