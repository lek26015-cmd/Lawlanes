'use server';

/**
 * การอ่านรายชื่อทนายแบบ "หลายคน" — ย้ายมาใช้ Admin SDK ทั้งหมด
 *
 * ทำไมต้องย้าย: firestore.rules เดิมเปิด `allow read, list: if true` บน
 * lawyerProfiles ซึ่งแปลว่าใครก็ยิง list ครั้งเดียวแล้วได้ phone, email,
 * address, dob, lineId, bankName, bankAccountNumber, idCardUrl, licenseUrl
 * ของทนายทุกคนในระบบ — การ strip ฟิลด์ใน src/lib/data.ts เป็นแค่เครื่องสำอาง
 * เพราะมันรันบน client SDK ข้อมูลเต็มถูกส่งมาถึง browser ไปแล้ว
 *
 * ย้ายมาที่นี่แล้วจึงปิด `list` ใน rules ได้ (ดู firestore.rules) โดยที่
 * การ์ดทนาย/ไดเรกทอรี/หน้าตรวจใบอนุญาต ยังเปิดให้คนไม่ล็อกอินใช้ได้ตามเดิม
 *
 * การอ่าน "ทีละคน" ก็ย้ายมาที่นี่ด้วย (getLawyerById ใน src/lib/data.ts ถูกลบแล้ว)
 * แยกตามบริบทว่าใครควรเห็นอะไร:
 *   - getPublicLawyerAction   — หน้าสาธารณะ/คนทั่วไป → PublicLawyer เท่านั้น
 *   - getChatLawyerAction     — คู่กรณีของเคส → PublicLawyer + uid + อีเมล (ใช้ทำสัญญา)
 *   - getMyLawyerProfileAction — เจ้าของโปรไฟล์เอง → โปรไฟล์เต็ม
 * (แอดมินอ่านเต็มผ่าน lawslane-admin อยู่แล้ว)
 */

import { initAdmin } from '@/lib/firebase-admin';
import { requireChatRole, requireLawyer } from '@/lib/auth-guard';
import type { LawyerProfile, LawyerSchedule } from '@/lib/types';

/** ฟิลด์ที่ปลอดภัยจะส่งออกสู่สาธารณะ — allowlist ไม่ใช่ blocklist */
export interface PublicLawyer {
    id: string;
    name: string;
    licenseNumber: string;
    status: string;
    specialty: string[];
    serviceProvinces: string[];
    description: string;
    descriptionEn?: string;
    descriptionZh?: string;
    education?: string;
    educationEn?: string;
    educationZh?: string;
    experience?: string;
    experienceEn?: string;
    experienceZh?: string;
    imageUrl: string;
    imageHint?: string;
    averageRating?: number;
    reviewCount?: number;
    firmId?: string;
    joinedAt: string | null;
    /** หน้าจองนัด (lawyers/[id]/schedule) ต้องรู้วันทำการ/วันหยุด — ตัดเหตุผลของวันหยุดทิ้ง */
    schedule?: LawyerSchedule;
}

/** ตารางเวลาแบบสาธารณะ — override เก็บแค่วันที่ ไม่ส่ง reason (อาจเป็นเรื่องส่วนตัว เช่น ลาป่วย) */
function toPublicSchedule(s: any): LawyerSchedule | undefined {
    if (!s || typeof s !== 'object' || !s.workingHours) return undefined;
    return {
        workingHours: {
            start: String(s.workingHours.start || ''),
            end: String(s.workingHours.end || ''),
        },
        availableDays: s.availableDays || {},
        overrides: Array.isArray(s.overrides)
            ? s.overrides
                .filter((ov: any) => ov && ov.date)
                .map((ov: any) => ({ date: String(ov.date), reason: '' }))
            : [],
    } as LawyerSchedule;
}

function toPublicLawyer(id: string, d: FirebaseFirestore.DocumentData): PublicLawyer {
    // สร้างทีละฟิลด์ ไม่ spread — ฟิลด์ใหม่ที่เพิ่มเข้า lawyerProfiles ในอนาคต
    // จะไม่หลุดออกสู่สาธารณะเองโดยอัตโนมัติ
    return {
        id,
        name: d.name || '',
        licenseNumber: d.licenseNumber || '',
        status: d.status || 'pending',
        specialty: Array.isArray(d.specialty) ? d.specialty : [],
        serviceProvinces: Array.isArray(d.serviceProvinces) ? d.serviceProvinces : [],
        description: d.description || '',
        descriptionEn: d.descriptionEn || undefined,
        descriptionZh: d.descriptionZh || undefined,
        education: d.education || undefined,
        educationEn: d.educationEn || undefined,
        educationZh: d.educationZh || undefined,
        experience: d.experience || undefined,
        experienceEn: d.experienceEn || undefined,
        experienceZh: d.experienceZh || undefined,
        imageUrl: d.imageUrl || '',
        imageHint: d.imageHint || undefined,
        averageRating: typeof d.averageRating === 'number' ? d.averageRating : undefined,
        reviewCount: typeof d.reviewCount === 'number' ? d.reviewCount : undefined,
        firmId: d.firmId || undefined,
        joinedAt: d.joinedAt?.toDate
            ? d.joinedAt.toDate().toISOString()
            : (typeof d.joinedAt === 'string' ? d.joinedAt : null),
        schedule: toPublicSchedule(d.schedule),
    };
}

/**
 * ตัด undefined ออกก่อนส่งข้าม server action boundary
 * (ส่งได้อยู่แล้ว แต่ทำให้ object ที่หน้าได้รับตรงกับที่เห็นใน Firestore)
 */
function clean<T>(o: T): T {
    return JSON.parse(JSON.stringify(o));
}

/**
 * โปรไฟล์ทนายรายคนสำหรับบริบทสาธารณะ — หน้าโปรไฟล์ (ต้องดูได้โดยไม่ล็อกอินตาม
 * PRD.md), หน้าจองนัด, หน้าชำระเงิน, หน้ารีวิว, หน้านัดหมาย
 *
 * เดิม getLawyerById() ใน src/lib/data.ts ยิง client SDK แล้ว strip ฟิลด์ทีหลัง
 * → ทั้งเอกสาร (เบอร์ ที่อยู่ เลขบัญชี ลิงก์บัตรประชาชน) ถึง browser ไปแล้ว
 * และหน้าโปรไฟล์ที่เป็น server component ก็ใช้ client SDK แบบไม่ล็อกอิน
 * ซึ่งจะพังทันทีที่ rules ปิด get — ย้ายมาใช้ Admin SDK + allowlist แทน
 */
export async function getPublicLawyerAction(lawyerId: string): Promise<PublicLawyer | null> {
    if (!lawyerId || typeof lawyerId !== 'string' || lawyerId.includes('/')) return null;
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return null;
        const snap = await adminApp.firestore().collection('lawyerProfiles').doc(lawyerId).get();
        if (!snap.exists) return null;
        return clean(toPublicLawyer(snap.id, snap.data() || {}));
    } catch (error) {
        console.error('Error fetching public lawyer:', error);
        return null;
    }
}

export type ChatLawyer = PublicLawyer & { userId: string; email: string };

/**
 * ทนายของเคสหนึ่งๆ สำหรับคู่กรณีของเคสนั้น (หน้าแชท)
 *
 * หน้าแชทต้องรู้ uid ของทนาย (ใช้ระบุผู้รับข้อความ/E2EE) และอีเมล (แสดงเป็นคู่สัญญา
 * ฝ่าย B ในสัญญา) — ให้เฉพาะคนที่เป็นคู่กรณีของเคสจริง (requireChatRole ตรวจจาก
 * เอกสารแชท ไม่ใช่จากค่าที่ผู้เรียกส่งมา) และ lawyerId มาจากเอกสารแชทเท่านั้น
 * จึงใช้ action นี้ขอข้อมูลติดต่อของทนายคนอื่นนอกเคสไม่ได้
 */
export async function getChatLawyerAction(chatId: string): Promise<ChatLawyer | null> {
    if (!chatId || typeof chatId !== 'string') return null;
    try {
        const { chatData, adminApp } = await requireChatRole(chatId);
        const lawyerProfileId: string = chatData.lawyerId || chatData.lawyer_id || '';
        if (!lawyerProfileId) return null;
        const snap = await adminApp.firestore().collection('lawyerProfiles').doc(lawyerProfileId).get();
        if (!snap.exists) return null;
        const d = snap.data() || {};
        return clean({
            ...toPublicLawyer(snap.id, d),
            userId: d.userId || '',
            email: d.email || '',
        });
    } catch {
        // ไม่ใช่คู่กรณี / ไม่ได้ล็อกอิน / ไม่มีห้อง — ให้หน้าแชท fallback ไปใช้ข้อมูลสาธารณะ
        return null;
    }
}

/**
 * โปรไฟล์เต็มของทนายที่ล็อกอินอยู่ — ใช้ในแดชบอร์ดทนาย และเช็ค "บัญชีนี้เป็นทนายไหม"
 *
 * ไม่รับ id เป็น argument: โปรไฟล์ที่คืนผูกกับ session เสมอ (requireLawyer หา
 * lawyerProfileId จาก userId จริง) จึงรองรับโปรไฟล์ที่แอดมินสร้างซึ่ง doc id ไม่ใช่ uid ด้วย
 * คืน null ถ้าไม่ได้ล็อกอินหรือบัญชีนี้ไม่ใช่ทนาย
 */
export async function getMyLawyerProfileAction(): Promise<LawyerProfile | null> {
    try {
        const { lawyerProfileId, adminApp } = await requireLawyer();
        const snap = await adminApp.firestore().collection('lawyerProfiles').doc(lawyerProfileId).get();
        if (!snap.exists) return null;
        const data = snap.data() || {};
        const iso = (v: any) => (v?.toDate ? v.toDate().toISOString() : (v ?? null));
        return clean({
            ...data,
            id: snap.id,
            joinedAt: iso(data.joinedAt),
            dob: iso(data.dob),
            updatedAt: iso(data.updatedAt),
            createdAt: iso(data.createdAt),
        }) as unknown as LawyerProfile;
    } catch {
        return null;
    }
}

export async function getApprovedLawyersAction(limitCount: number = 50): Promise<PublicLawyer[]> {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return [];
        const snap = await adminApp.firestore()
            .collection('lawyerProfiles')
            .where('status', '==', 'approved')
            .limit(limitCount)
            .get();
        return snap.docs.map(doc => toPublicLawyer(doc.id, doc.data()));
    } catch (error) {
        console.error('Error fetching approved lawyers:', error);
        return [];
    }
}

export async function getLawyersByFirmAction(firmId: string): Promise<PublicLawyer[]> {
    if (!firmId) return [];
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return [];
        const snap = await adminApp.firestore()
            .collection('lawyerProfiles')
            .where('firmId', '==', firmId)
            .get();
        return snap.docs
            .map(doc => toPublicLawyer(doc.id, doc.data()))
            .filter(l => l.status === 'approved');
    } catch (error) {
        console.error('Error fetching firm lawyers:', error);
        return [];
    }
}

/**
 * ค้นทนายสำหรับหน้าตรวจสอบใบอนุญาต (/verify-lawyer)
 * คืนเฉพาะสิ่งที่หน้านั้นต้องใช้จริง ไม่ใช่ทั้งโปรไฟล์
 */
export async function searchApprovedLawyersAction(params: {
    licenseNumber?: string;
    name?: string;
}): Promise<PublicLawyer[]> {
    const licenseNumber = params.licenseNumber?.trim();
    const name = params.name?.trim();
    if (!licenseNumber && !name) return [];

    try {
        const adminApp = await initAdmin();
        if (!adminApp) return [];
        const col = adminApp.firestore().collection('lawyerProfiles');

        if (licenseNumber) {
            const snap = await col
                .where('licenseNumber', '==', licenseNumber)
                .where('status', '==', 'approved')
                .limit(5)
                .get();
            return snap.docs.map(doc => toPublicLawyer(doc.id, doc.data()));
        }

        // ค้นด้วยชื่อ: คงพฤติกรรมเดิมของหน้า /verify-lawyer คือ exact match
        // (ถ้าจะเปลี่ยนเป็น prefix range ต้องเพิ่ม composite index status+name ก่อน)
        const snap = await col
            .where('name', '==', name!)
            .where('status', '==', 'approved')
            .limit(10)
            .get();
        return snap.docs.map(doc => toPublicLawyer(doc.id, doc.data()));
    } catch (error) {
        console.error('Error searching lawyers:', error);
        return [];
    }
}
