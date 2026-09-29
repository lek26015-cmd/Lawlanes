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
    /** จำนวนคำถาม AI ต่อวัน (เวลาไทย) — null = ไม่จำกัด */
    aiMessagesPerDay: number | null;
    /** เผยแพร่หน้าเว็บส่วนตัว lawslane.com/p/... */
    personalSite: boolean;
};

export type LawyerFeature = 'caseManagement' | 'invoices' | 'aiAssistant' | 'personalSite';

export const LAWYER_ENTITLEMENT_DEFAULTS: Record<PlanTier, LawyerEntitlements> = {
    free: { caseManagement: false, invoices: false, aiAssistant: false, aiMessagesPerDay: 0, personalSite: false },
    pro: { caseManagement: true, invoices: true, aiAssistant: true, aiMessagesPerDay: null, personalSite: true },
    top: { caseManagement: true, invoices: true, aiAssistant: true, aiMessagesPerDay: null, personalSite: true },
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
        const n = s.aiMessagesPerDay;
        if (n === null || (typeof n === 'number' && Number.isInteger(n) && n >= 0)) v.aiMessagesPerDay = n as number | null;
        out[tier] = v;
    }
    return out;
}
