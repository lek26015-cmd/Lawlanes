'use server';

/**
 * สมัครเป็นล่าม / ล่ามแก้โปรไฟล์ของตัวเอง
 *
 * firestore.rules ไม่ให้ client เขียน interpreterProfiles เลย — ทุกการเขียนผ่านที่นี่
 * เพื่อบังคับ: status เริ่มที่ 'pending' เสมอ · ราคาอยู่ในขอบเขต · verifiedCredentials
 * แอดมินตั้งเท่านั้น · doc id = uid ของผู้เรียกเสมอ (ไม่รับ id จาก client)
 *
 * ข้อมูลติดต่อ เอกสาร และบัญชีรับเงิน เก็บใน interpreterProfiles/{uid}/private/details
 * ซึ่งหน้าสาธารณะไม่อ่านเลย
 */

import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { requireUser, requireInterpreter, AuthError } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { sanitizeRateItem } from '@/lib/interpreter-pricing';
import { initAdmin } from '@/lib/firebase-admin';
import { readGpPercent, toPublicInterpreter } from '@/lib/interpreter-public';
import { NotificationService } from '@/services/notification-service';
import {
    DEFAULT_GP_PERCENT,
    INTERPRETER_LANGUAGE_CODES,
    INTERPRETER_LANGUAGE_LEVELS,
    INTERPRETER_SERVICES,
    RATE_LIMITS,
    type InterpreterLanguage,
    type InterpreterService,
    type RateItem,
    type MyInterpreterProfile,
} from '@/lib/interpreter-types';
import type { LawyerSchedule } from '@/lib/types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function escapeHtml(v: string) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function errorResult(e: unknown, fallback: string): { ok: false; error: string } {
    if (e instanceof AuthError) return { ok: false, error: e.status === 401 ? 'กรุณาเข้าสู่ระบบก่อน' : 'ไม่มีสิทธิ์ทำรายการนี้' };
    console.error(fallback, e);
    return { ok: false, error: fallback };
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function sanitizeLanguages(v: unknown): InterpreterLanguage[] | null {
    if (!Array.isArray(v) || v.length < 2 || v.length > INTERPRETER_LANGUAGE_CODES.length) return null;
    const seen = new Set<string>();
    const out: InterpreterLanguage[] = [];
    for (const l of v) {
        if (!l || !(INTERPRETER_LANGUAGE_CODES as readonly string[]).includes(l.code)) return null;
        if (!(INTERPRETER_LANGUAGE_LEVELS as readonly string[]).includes(l.level)) return null;
        if (seen.has(l.code)) continue;
        seen.add(l.code);
        out.push({ code: l.code, level: l.level });
    }
    return out.length >= 2 ? out : null;
}

function sanitizeServices(v: unknown): InterpreterService[] | null {
    if (!Array.isArray(v) || v.length === 0) return null;
    const out = [...new Set(v)].filter((s): s is InterpreterService => (INTERPRETER_SERVICES as readonly string[]).includes(s as string));
    return out.length > 0 ? out : null;
}

function sanitizeStringList(v: unknown, maxItems: number, maxLen: number): string[] {
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map(x => str(x, maxLen)).filter(Boolean))].slice(0, maxItems);
}

/** เรทการ์ดทั้งชุด — อย่างน้อย 1 รายการ · id ใหม่ให้รายการที่ยังไม่มี (id เดิมคงไว้เพื่อให้ลิงก์จองเดิมยังใช้ได้) */
function sanitizeRateCard(v: unknown): { ok: true; items: RateItem[] } | { ok: false; error: string } {
    if (!Array.isArray(v) || v.length === 0) return { ok: false, error: 'กรุณาเพิ่มรายการในเรทการ์ดอย่างน้อย 1 รายการ' };
    if (v.length > RATE_LIMITS.maxItems) return { ok: false, error: `เรทการ์ดมีได้ไม่เกิน ${RATE_LIMITS.maxItems} รายการ` };
    const items: RateItem[] = [];
    const ids = new Set<string>();
    for (const raw of v) {
        const r = sanitizeRateItem(raw);
        if (!r.ok) return r;
        let id = r.item.id;
        if (!id || ids.has(id)) id = uuidv4().replace(/-/g, '').slice(0, 12);
        ids.add(id);
        items.push({ ...r.item, id });
    }
    return { ok: true, items };
}

/**
 * รูปโปรไฟล์ต้องมาจาก storage ของเราเท่านั้น — หน้าสาธารณะแสดงด้วย next/image ซึ่งจะ error
 * ทั้งหน้าถ้า host ไม่อยู่ใน images.remotePatterns (next.config.ts) และกันการฝังรูปจากเว็บภายนอก
 */
const IMAGE_HOSTS = ['storage.googleapis.com', 'firebasestorage.googleapis.com', 'imagedelivery.net'];
function safeImageUrl(v: unknown): string {
    const u = str(v, 500);
    try {
        const url = new URL(u);
        return url.protocol === 'https:' && IMAGE_HOSTS.includes(url.hostname) ? url.toString() : '';
    } catch {
        return '';
    }
}

/** path เอกสารต้องเป็นไฟล์ที่ผู้เรียกอัปโหลดเองผ่าน uploadInterpreterFileAction เท่านั้น */
function ownPaths(v: unknown, uid: string, prefix: string, max: number): string[] {
    return sanitizeStringList(v, max, 300).filter(p => p.startsWith(`${prefix}/${uid}/`) && !p.includes('..'));
}

/** GP % ปัจจุบัน — หน้าเว็บใช้แสดงให้ล่ามเห็นว่าจะได้รับเท่าไร (ค่านี้ไม่ใช่ความลับ) */
export async function getInterpreterGpPercentAction(): Promise<number> {
    try {
        const app = await initAdmin();
        if (!app) return DEFAULT_GP_PERCENT;
        return await readGpPercent(app.firestore());
    } catch {
        return DEFAULT_GP_PERCENT;
    }
}

/**
 * อัปโหลดเอกสารของล่าม (บัตรประชาชน/ใบรับรอง) หรือเอกสารที่ลูกค้าให้แปล — เก็บแบบ private
 * โฟลเดอร์ผูกกับ uid ของผู้เรียกฝั่ง server เสมอ อ่านได้ผ่าน Admin SDK (แอดมิน/secure-view) เท่านั้น
 */
export async function uploadInterpreterFileAction(
    formData: FormData,
    purpose: 'credential' | 'booking'
): Promise<Result<{ path: string }>> {
    try {
        const { uid, adminApp } = await requireUser();
        const limit = await checkRateLimit(`interpreter-upload:${uid}`, 30, 60 * 60 * 1000);
        if (!limit.success) return { ok: false, error: 'อัปโหลดถี่เกินไป กรุณาลองใหม่ภายหลัง' };

        const file = formData.get('file');
        if (!(file instanceof File)) return { ok: false, error: 'ไม่พบไฟล์' };
        if (file.size > 15 * 1024 * 1024) return { ok: false, error: 'ไฟล์ใหญ่เกิน 15MB' };
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowed.includes(file.type)) return { ok: false, error: 'รองรับเฉพาะ JPG, PNG, WEBP หรือ PDF' };

        const folder = purpose === 'credential' ? 'interpreter_documents' : 'interpreter_booking_docs';
        const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1];
        const destination = `${folder}/${uid}/${uuidv4()}.${ext}`;

        const bucketName = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').replace(/"/g, '').trim();
        const bucket = bucketName ? adminApp.storage().bucket(bucketName) : adminApp.storage().bucket();
        await bucket.file(destination).save(Buffer.from(await file.arrayBuffer()), {
            metadata: { contentType: file.type, metadata: { uploadedBy: uid } },
            public: false,
        });
        return { ok: true, path: destination };
    } catch (e) {
        return errorResult(e, 'อัปโหลดไฟล์ไม่สำเร็จ');
    }
}

export type InterpreterRegistrationInput = {
    name: string;
    phone: string;
    lineId?: string;
    imageUrl?: string;
    description: string;
    languages: InterpreterLanguage[];
    services: InterpreterService[];
    specialties?: string[];
    serviceProvinces: string[];
    remoteAvailable: boolean;
    rateCard: RateItem[];
    idCardPath: string;
    certificatePaths?: string[];
    acceptTerms: boolean;
    /** ยอมรับข้อกำหนดการใช้งานเว็บไซต์ + นโยบายความเป็นส่วนตัว (แยกจากเงื่อนไข GP) */
    acceptSiteTerms: boolean;
};

/**
 * สมัครเป็นล่าม — ใช้บัญชีที่ล็อกอินอยู่ (ลูกค้าเดิมสมัครเป็นล่ามได้ ไม่ต้องสร้างบัญชีใหม่)
 * สร้างโปรไฟล์ 'pending' แล้วแจ้งแอดมิน · สมัครซ้ำไม่ได้ถ้ามีโปรไฟล์อยู่แล้ว
 */
export async function registerInterpreterAction(input: InterpreterRegistrationInput): Promise<Result> {
    try {
        const { uid, token, adminApp } = await requireUser();
        const db = adminApp.firestore();

        const limit = await checkRateLimit(`interpreter-register:${uid}`, 3, 60 * 60 * 1000);
        if (!limit.success) return { ok: false, error: 'ส่งใบสมัครถี่เกินไป กรุณาลองใหม่ภายหลัง' };

        if (input?.acceptTerms !== true) return { ok: false, error: 'กรุณายอมรับเงื่อนไขการให้บริการ' };
        if (input?.acceptSiteTerms !== true) return { ok: false, error: 'กรุณายอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว' };
        const name = str(input.name, 100);
        const phone = str(input.phone, 30);
        const description = str(input.description, 3000);
        if (!name) return { ok: false, error: 'กรุณากรอกชื่อ' };
        if (!/^[0-9+\-\s()]{8,30}$/.test(phone)) return { ok: false, error: 'เบอร์โทรไม่ถูกต้อง' };
        if (description.length < 30) return { ok: false, error: 'กรุณาแนะนำตัวและประสบการณ์อย่างน้อย 30 ตัวอักษร' };

        const languages = sanitizeLanguages(input.languages);
        if (!languages) return { ok: false, error: 'กรุณาเลือกภาษาอย่างน้อย 2 ภาษา' };
        const services = sanitizeServices(input.services);
        if (!services) return { ok: false, error: 'กรุณาเลือกบริการอย่างน้อย 1 อย่าง' };
        const rateCard = sanitizeRateCard(input.rateCard);
        if (!rateCard.ok) return { ok: false, error: rateCard.error };

        const [idCardPath] = ownPaths([input.idCardPath], uid, 'interpreter_documents', 1);
        if (!idCardPath) return { ok: false, error: 'กรุณาอัปโหลดบัตรประชาชนหรือพาสปอร์ต' };
        const certificatePaths = ownPaths(input.certificatePaths, uid, 'interpreter_documents', 10);

        const imageUrl = safeImageUrl(input.imageUrl);
        const profileRef = db.collection('interpreterProfiles').doc(uid);
        const now = admin.firestore.FieldValue.serverTimestamp();

        await db.runTransaction(async (tx) => {
            const existing = await tx.get(profileRef);
            if (existing.exists) throw new AuthError('คุณสมัครเป็นล่ามไว้แล้ว', 409);
            tx.create(profileRef, {
                userId: uid,
                name,
                imageUrl,
                description,
                languages,
                languageCodes: languages.map(l => l.code),
                services,
                specialties: sanitizeStringList(input.specialties, 20, 60),
                serviceProvinces: sanitizeStringList(input.serviceProvinces, 77, 60),
                remoteAvailable: input.remoteAvailable === true,
                rateCard: rateCard.items,
                verifiedCredentials: [],
                status: 'pending',
                createdAt: now,
                updatedAt: now,
            });
            tx.set(profileRef.collection('private').doc('details'), {
                phone,
                email: token.email || '',
                lineId: str(input.lineId, 50),
                idCardPath,
                certificatePaths,
                termsAcceptedAt: now,
                siteTermsAcceptedAt: now,
            });
        });

        await db.collection('notifications').add({
            type: 'interpreter_registration',
            title: 'ล่ามสมัครใหม่',
            message: `${name} สมัครเป็นล่าม รอตรวจเอกสาร`,
            createdAt: now,
            read: false,
            recipient: 'admin',
            link: `/interpreters/${uid}`,
            relatedId: uid,
        });
        NotificationService.notifyAdminNewInterpreter(escapeHtml(name)).catch(err =>
            console.error('notifyAdminNewInterpreter failed:', err)
        );

        return { ok: true };
    } catch (e) {
        if (e instanceof AuthError && e.status === 409) return { ok: false, error: e.message };
        return errorResult(e, 'ส่งใบสมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
}

/** โปรไฟล์ของล่ามที่ล็อกอินอยู่ (รวม private) · null ถ้าไม่ใช่ล่าม */
export async function getMyInterpreterProfileAction(): Promise<MyInterpreterProfile | null> {
    try {
        const { uid, profile, adminApp } = await requireInterpreter({ allowPending: true });
        const priv = (await adminApp.firestore()
            .collection('interpreterProfiles').doc(uid).collection('private').doc('details').get()).data() || {};
        const result: MyInterpreterProfile = {
            ...toPublicInterpreter(uid, profile),
            rejectionReason: profile.rejectionReason || undefined,
            private: {
                phone: priv.phone || '',
                email: priv.email || '',
                lineId: priv.lineId || undefined,
                idCardPath: priv.idCardPath || undefined,
                certificatePaths: Array.isArray(priv.certificatePaths) ? priv.certificatePaths : [],
                bankName: priv.bankName || undefined,
                bankAccountNumber: priv.bankAccountNumber || undefined,
                bankAccountName: priv.bankAccountName || undefined,
            },
        };
        return JSON.parse(JSON.stringify(result));
    } catch {
        return null;
    }
}

export async function updateMyInterpreterProfileAction(input: {
    description?: string;
    imageUrl?: string;
    languages?: InterpreterLanguage[];
    services?: InterpreterService[];
    specialties?: string[];
    serviceProvinces?: string[];
    remoteAvailable?: boolean;
    rateCard?: RateItem[];
    phone?: string;
    lineId?: string;
}): Promise<Result> {
    try {
        const { uid, adminApp } = await requireInterpreter({ allowPending: true });
        const db = adminApp.firestore();
        const update: Record<string, unknown> = {};
        const privUpdate: Record<string, unknown> = {};

        if (input.description !== undefined) {
            const d = str(input.description, 3000);
            if (d.length < 30) return { ok: false, error: 'คำแนะนำตัวต้องมีอย่างน้อย 30 ตัวอักษร' };
            update.description = d;
        }
        if (input.imageUrl !== undefined) update.imageUrl = safeImageUrl(input.imageUrl);
        if (input.languages !== undefined) {
            const l = sanitizeLanguages(input.languages);
            if (!l) return { ok: false, error: 'กรุณาเลือกภาษาอย่างน้อย 2 ภาษา' };
            update.languages = l;
            update.languageCodes = l.map(x => x.code);
        }
        if (input.services !== undefined) {
            const s = sanitizeServices(input.services);
            if (!s) return { ok: false, error: 'กรุณาเลือกบริการอย่างน้อย 1 อย่าง' };
            update.services = s;
        }
        if (input.specialties !== undefined) update.specialties = sanitizeStringList(input.specialties, 20, 60);
        if (input.serviceProvinces !== undefined) update.serviceProvinces = sanitizeStringList(input.serviceProvinces, 77, 60);
        if (input.remoteAvailable !== undefined) update.remoteAvailable = input.remoteAvailable === true;
        if (input.rateCard !== undefined) {
            const r = sanitizeRateCard(input.rateCard);
            if (!r.ok) return { ok: false, error: r.error };
            update.rateCard = r.items;
        }
        if (input.phone !== undefined) {
            const phone = str(input.phone, 30);
            if (!/^[0-9+\-\s()]{8,30}$/.test(phone)) return { ok: false, error: 'เบอร์โทรไม่ถูกต้อง' };
            privUpdate.phone = phone;
        }
        if (input.lineId !== undefined) privUpdate.lineId = str(input.lineId, 50);

        const ref = db.collection('interpreterProfiles').doc(uid);
        const batch = db.batch();
        if (Object.keys(update).length) batch.update(ref, { ...update, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        if (Object.keys(privUpdate).length) batch.set(ref.collection('private').doc('details'), privUpdate, { merge: true });
        await batch.commit();
        return { ok: true };
    } catch (e) {
        return errorResult(e, 'บันทึกโปรไฟล์ไม่สำเร็จ');
    }
}

export async function updateInterpreterScheduleAction(schedule: LawyerSchedule): Promise<Result> {
    try {
        const { uid, adminApp } = await requireInterpreter({ allowPending: true });
        const hhmm = /^([01]\d|2[0-3]):00$/;
        const start = str(schedule?.workingHours?.start, 5);
        const end = str(schedule?.workingHours?.end, 5);
        if (!hhmm.test(start) || !(hhmm.test(end) || end === '24:00') || start >= end) {
            return { ok: false, error: 'เวลาทำงานต้องเป็นชั่วโมงเต็ม และเวลาเริ่มต้องก่อนเวลาเลิก' };
        }
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
        const availableDays = Object.fromEntries(days.map(d => [d, schedule?.availableDays?.[d] === true]));
        const overrides = (Array.isArray(schedule?.overrides) ? schedule.overrides : [])
            .filter(o => o && /^\d{4}-\d{2}-\d{2}/.test(String(o.date)))
            .slice(0, 100)
            .map(o => ({ date: String(o.date).slice(0, 10), reason: str(o.reason, 100) }));
        await adminApp.firestore().collection('interpreterProfiles').doc(uid).update({
            schedule: { workingHours: { start, end }, availableDays, overrides },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { ok: true };
    } catch (e) {
        return errorResult(e, 'บันทึกตารางเวลาไม่สำเร็จ');
    }
}

/** บัญชีรับเงิน — แอดมินใช้โอนค่าจ้างหลังหัก GP · เก็บใน private เท่านั้น */
export async function updateInterpreterPayoutDetailsAction(input: {
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
}): Promise<Result> {
    try {
        const { uid, adminApp } = await requireInterpreter({ allowPending: true });
        const bankName = str(input?.bankName, 60);
        const bankAccountNumber = str(input?.bankAccountNumber, 20).replace(/[\s-]/g, '');
        const bankAccountName = str(input?.bankAccountName, 100);
        if (!bankName || !bankAccountName) return { ok: false, error: 'กรุณากรอกข้อมูลบัญชีให้ครบ' };
        if (!/^\d{10,15}$/.test(bankAccountNumber)) return { ok: false, error: 'เลขบัญชีต้องเป็นตัวเลข 10-15 หลัก' };
        await adminApp.firestore()
            .collection('interpreterProfiles').doc(uid).collection('private').doc('details')
            .set({ bankName, bankAccountNumber, bankAccountName, bankUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return { ok: true };
    } catch (e) {
        return errorResult(e, 'บันทึกบัญชีไม่สำเร็จ');
    }
}
