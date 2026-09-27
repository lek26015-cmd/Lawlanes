import type { LegalLocale } from './types';

/** วันที่ปรับปรุงเอกสารกฎหมายทั้งชุดครั้งล่าสุด (YYYY-MM-DD) — แก้เนื้อหาเมื่อไรให้เลื่อนวันนี้ด้วย */
export const LEGAL_LAST_UPDATED = '2026-09-26';

export const CONTACT_EMAIL = 'contact@lawslane.com';

/**
 * ผู้ให้บริการ — ตอนนี้ Lawslane เป็นสตาร์ทอัพที่ยังไม่ได้จดทะเบียนนิติบุคคล ผู้ควบคุมข้อมูลตาม PDPA
 * จึงเป็นบุคคลธรรมดาผู้ดำเนินงาน ช่อง [[...]] แสดงเป็นไฮไลต์จนกว่าจะกรอกค่าจริง (กรอกแล้วเอา [[ ]] ออก)
 *
 * จดทะเบียนบริษัทแล้ว: เปลี่ยน name เป็นชื่อบริษัท เพิ่มเลขทะเบียนในข้อความ intro/ผู้ควบคุมข้อมูล
 * ของ terms.ts / privacy.ts ลบประโยค "ยังไม่ได้จดทะเบียน" แล้วเลื่อน LEGAL_LAST_UPDATED
 * และแจ้งผู้ใช้ล่วงหน้าตามข้อ "การแก้ไข" ในเอกสาร
 */
export const COMPANY: Record<LegalLocale, {
    name: string;
    address: string;
    retentionDays: string;
}> = {
    th: {
        name: '[[ชื่อ-นามสกุลผู้ดำเนินงาน]]',
        address: '[[ที่อยู่สำหรับติดต่อ]]',
        retentionDays: '[[90]]',
    },
    en: {
        name: '[[Operator full name]]',
        address: '[[Contact address]]',
        retentionDays: '[[90]]',
    },
    zh: {
        name: '[[运营者姓名]]',
        address: '[[联系地址]]',
        retentionDays: '[[90]]',
    },
};

export const LEGAL_LABELS: Record<LegalLocale, {
    lastUpdated: string;
    contents: string;
    translationNote: string | null;
    related: string;
    terms: string;
    privacy: string;
    cookies: string;
    aiDisclaimer: string;
}> = {
    th: {
        lastUpdated: 'ปรับปรุงล่าสุด',
        contents: 'สารบัญ',
        translationNote: null,
        related: 'เอกสารที่เกี่ยวข้อง',
        terms: 'ข้อกำหนดการใช้งาน',
        privacy: 'นโยบายความเป็นส่วนตัว',
        cookies: 'นโยบายคุกกี้',
        aiDisclaimer: 'ข้อจำกัดความรับผิดของ AI',
    },
    en: {
        lastUpdated: 'Last updated',
        contents: 'Contents',
        translationNote: 'This is a translation for convenience. If it differs from the Thai version, the Thai version prevails.',
        related: 'Related documents',
        terms: 'Terms of Service',
        privacy: 'Privacy Policy',
        cookies: 'Cookie Policy',
        aiDisclaimer: 'AI Disclaimer',
    },
    zh: {
        lastUpdated: '最后更新',
        contents: '目录',
        translationNote: '本译文仅供参考。如与泰文版本不一致，以泰文版本为准。',
        related: '相关文件',
        terms: '服务条款',
        privacy: '隐私政策',
        cookies: 'Cookie 政策',
        aiDisclaimer: 'AI 免责声明',
    },
};

export function toLegalLocale(locale: string): LegalLocale {
    return locale === 'en' || locale === 'zh' ? locale : 'th';
}

export function formatLegalDate(locale: LegalLocale, isoDate = LEGAL_LAST_UPDATED): string {
    const tag = locale === 'th' ? 'th-TH' : locale === 'zh' ? 'zh-CN' : 'en-US';
    return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(tag, { dateStyle: 'long', timeZone: 'UTC' });
}
