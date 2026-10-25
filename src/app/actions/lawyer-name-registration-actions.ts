'use server';

import * as admin from 'firebase-admin';
import { headers } from 'next/headers';
import { initAdmin } from '@/lib/firebase-admin';
import { checkUpstashRateLimit, formRateLimiter } from '@/lib/upstash-ratelimit';
import { THAI_PROVINCES } from '@/lib/thai-provinces';

/**
 * ทนายลงทะเบียนชื่อเอง เพื่อให้ลูกความค้นชื่อ/เลขใบอนุญาตเจอในหน้า /verify-lawyer
 *
 * - เขียนลง verifiedLawyers เป็น status 'pending' + source 'self_registration'
 *   หน้าค้นหาอ่านเฉพาะ active/announced → ยังไม่แสดงจนกว่าแอดมินตรวจกับสภาทนายความแล้วอนุมัติ
 *   (หลังบ้าน /lawyer-registry/self-registrations)
 * - สาธารณะเห็นแค่ฟิลด์ใน toPublicRegistryLawyer (ชื่อ เลข จังหวัด) — เบอร์/อีเมลใน selfRegistration
 *   เป็นช่องทางให้แอดมินติดต่อกลับเท่านั้น (rules ให้อ่าน verifiedLawyers ได้แค่แอดมิน)
 * - ไม่ตั้ง updatedAt ตอนสร้าง: getRegistryStats ใช้ updatedAt เป็น "อัปเดตล่าสุด" ของทะเบียน
 *   รายการที่ยังไม่อนุมัติไม่ควรขยับวันที่นั้น · แอดมินตั้งตอนอนุมัติ
 */

const LICENSE_RE = /^\d{1,6}\/\d{4}$/;
const PROVINCES = new Set(THAI_PROVINCES.flatMap((r) => r.provinces));
const PREFIXES = new Set(['นาย', 'นาง', 'นางสาว', 'ว่าที่ร้อยตรี', 'ว่าที่ร้อยตรีหญิง', 'ดร.', 'อื่น ๆ']);

export type NameRegistrationResult =
    | { ok: true }
    | { ok: false; reason: 'invalid' | 'license_format' | 'already_listed' | 'already_pending' | 'on_lawslane' | 'rate_limited' | 'error' };

export interface NameRegistrationInput {
    prefix: string;
    firstName: string;
    lastName: string;
    licenseNumber: string;
    province: string;
    phone: string;
    email: string;
    consent: boolean;
    locale: string;
}

function str(v: unknown, max: number) {
    return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

// เลขไทย ๐-๙ → 0-9 และตัดช่องว่าง: ทนายพิมพ์ "๑๒๓๔๕ / ๒๕๕๐" ได้
function normalizeLicense(v: unknown) {
    return str(v, 30)
        .replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50))
        .replace(/\s+/g, '');
}

async function getIp() {
    const h = await headers();
    return h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
}

export async function submitLawyerNameRegistrationAction(input: NameRegistrationInput): Promise<NameRegistrationResult> {
    const ip = await getIp();
    const rate = await checkUpstashRateLimit(ip, formRateLimiter);
    if (!rate.success) return { ok: false, reason: 'rate_limited' };

    const prefix = PREFIXES.has(str(input.prefix, 30)) ? str(input.prefix, 30) : '';
    const firstName = str(input.firstName, 100);
    const lastName = str(input.lastName, 100);
    const licenseNumber = normalizeLicense(input.licenseNumber);
    const province = PROVINCES.has(str(input.province, 50)) ? str(input.province, 50) : '';
    const phone = str(input.phone, 30).replace(/[^\d+]/g, '');
    const email = str(input.email, 254).toLowerCase();

    if (!firstName || !lastName || input.consent !== true) return { ok: false, reason: 'invalid' };
    if (phone.replace(/\D/g, '').length < 9 || phone.length > 15) return { ok: false, reason: 'invalid' };
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: 'invalid' };
    if (!LICENSE_RE.test(licenseNumber)) return { ok: false, reason: 'license_format' };

    try {
        const app = await initAdmin();
        if (!app) return { ok: false, reason: 'error' };
        const db = app.firestore();

        const [registry, profiles] = await Promise.all([
            db.collection('verifiedLawyers').where('licenseNumber', '==', licenseNumber).limit(5).get(),
            db.collection('lawyerProfiles').where('licenseNumber', '==', licenseNumber).where('status', '==', 'approved').limit(1).get(),
        ]);
        if (!profiles.empty) return { ok: false, reason: 'on_lawslane' };
        if (registry.docs.some((d) => d.get('status') === 'active')) return { ok: false, reason: 'already_listed' };
        if (registry.docs.some((d) => d.get('status') === 'pending')) return { ok: false, reason: 'already_pending' };

        await db.collection('verifiedLawyers').add({
            prefix,
            firstName,
            lastName,
            licenseNumber,
            licenseType: '',
            province,
            status: 'pending',
            source: 'self_registration',
            selfRegistration: {
                phone,
                email,
                consentAt: admin.firestore.FieldValue.serverTimestamp(),
                locale: str(input.locale, 5),
                ipAddress: ip,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { ok: true };
    } catch (error: any) {
        console.error('submitLawyerNameRegistrationAction failed', error?.message);
        return { ok: false, reason: 'error' };
    }
}
