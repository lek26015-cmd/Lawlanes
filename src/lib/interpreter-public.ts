import 'server-only';

/**
 * แปลงเอกสาร interpreterProfiles เป็นข้อมูลที่ส่งออกสู่สาธารณะได้ (allowlist)
 * ใช้ร่วมกันระหว่าง directory / profile / booking actions
 */

import {
    DEFAULT_GP_PERCENT,
    GP_LIMITS,
    INTERPRETER_LANGUAGE_CODES,
    INTERPRETER_SERVICES,
    type InterpreterLanguage,
    type PublicInterpreter,
} from './interpreter-types';
import type { LawyerSchedule } from './types';
import { sanitizeRateItem } from './interpreter-pricing';
import { CONTACT_UNLOCK_STATUSES } from './interpreter-chat-utils';
import type { InterpreterContactInfo } from './interpreter-types';

function toPublicSchedule(s: any): LawyerSchedule | undefined {
    if (!s || typeof s !== 'object' || !s.workingHours) return undefined;
    return {
        workingHours: { start: String(s.workingHours.start || ''), end: String(s.workingHours.end || '') },
        availableDays: s.availableDays || {},
        overrides: Array.isArray(s.overrides)
            ? s.overrides.filter((ov: any) => ov && ov.date).map((ov: any) => ({ date: String(ov.date), reason: '' }))
            : [],
    } as LawyerSchedule;
}

/** สร้างทีละฟิลด์ ไม่ spread — ฟิลด์ใหม่ในอนาคตจะไม่หลุดสู่สาธารณะเอง */
export function toPublicInterpreter(id: string, d: FirebaseFirestore.DocumentData): PublicInterpreter {
    const languages: InterpreterLanguage[] = Array.isArray(d.languages)
        ? d.languages
            .filter((l: any) => l && (INTERPRETER_LANGUAGE_CODES as readonly string[]).includes(l.code))
            .map((l: any) => ({ code: l.code, level: l.level }))
        : [];
    return {
        id,
        name: d.name || '',
        imageUrl: d.imageUrl || '',
        description: d.description || '',
        descriptionEn: d.descriptionEn || undefined,
        descriptionZh: d.descriptionZh || undefined,
        languages,
        languageCodes: languages.map(l => l.code),
        services: Array.isArray(d.services)
            ? d.services.filter((s: any) => (INTERPRETER_SERVICES as readonly string[]).includes(s))
            : [],
        specialties: Array.isArray(d.specialties) ? d.specialties.map(String) : [],
        serviceProvinces: Array.isArray(d.serviceProvinces) ? d.serviceProvinces.map(String) : [],
        remoteAvailable: d.remoteAvailable === true,
        rateCard: Array.isArray(d.rateCard)
            ? d.rateCard.flatMap((r: any) => { const c = sanitizeRateItem(r); return c.ok && c.item.id ? [c.item] : []; })
            : [],
        schedule: toPublicSchedule(d.schedule),
        verifiedCredentials: Array.isArray(d.verifiedCredentials) ? d.verifiedCredentials.map(String) : [],
        averageRating: typeof d.averageRating === 'number' ? d.averageRating : undefined,
        reviewCount: typeof d.reviewCount === 'number' ? d.reviewCount : undefined,
        status: d.status || 'pending',
        joinedAt: d.joinedAt?.toDate ? d.joinedAt.toDate().toISOString() : null,
    };
}

/**
 * GP % ปัจจุบันจาก settings/interpreterFees (แอดมินตั้งใน lawslane-admin)
 * ค่าที่อ่านไม่ได้/นอกช่วง → ใช้ค่า default แทนการปล่อยให้ GP เป็น 0 โดยไม่ตั้งใจ
 * ส่ง tx มาเพื่ออ่านใน transaction เดียวกับการสร้าง booking
 */
export async function readGpPercent(
    db: FirebaseFirestore.Firestore,
    tx?: FirebaseFirestore.Transaction
): Promise<number> {
    const ref = db.collection('settings').doc('interpreterFees');
    const snap = tx ? await tx.get(ref) : await ref.get();
    const v = snap.data()?.gpPercent;
    return typeof v === 'number' && Number.isFinite(v) && v >= GP_LIMITS.min && v <= GP_LIMITS.max
        ? v
        : DEFAULT_GP_PERCENT;
}

// ---------------------------------------------------------------------------
// ข้อมูลติดต่อ — เปิดเผยได้หลังลูกค้าจ่ายเงินแล้วเท่านั้น (ดู lib/interpreter-chat-utils.ts)
// ---------------------------------------------------------------------------


/** booking ที่จ่ายแล้วล่าสุดระหว่างคู่นี้ หรือ null */
export async function latestPaidBooking(
    db: FirebaseFirestore.Firestore,
    customerId: string,
    interpreterId: string
): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
    const snap = await db.collection('interpreterBookings')
        .where('customerId', '==', customerId)
        .where('interpreterId', '==', interpreterId)
        .where('status', 'in', CONTACT_UNLOCK_STATUSES)
        .limit(20)
        .get();
    if (snap.empty) return null;
    return snap.docs.sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0))[0];
}

export async function interpreterContact(db: FirebaseFirestore.Firestore, interpreterId: string): Promise<InterpreterContactInfo> {
    const ref = db.collection('interpreterProfiles').doc(interpreterId);
    const [p, priv] = await Promise.all([ref.get(), ref.collection('private').doc('details').get()]);
    return {
        name: p.data()?.name || '',
        phone: priv.data()?.phone || '',
        lineId: priv.data()?.lineId || undefined,
        email: priv.data()?.email || undefined,
    };
}

/** เบอร์/LINE ที่ลูกค้ากรอกตอนจอง (เก็บใน private ของ booking) — ถ้าไม่มีใช้จากบัญชีผู้ใช้ */
export async function customerContact(
    db: FirebaseFirestore.Firestore,
    customerId: string,
    bookingRef: FirebaseFirestore.DocumentReference | null
): Promise<InterpreterContactInfo> {
    const [user, priv] = await Promise.all([
        db.collection('users').doc(customerId).get(),
        bookingRef ? bookingRef.collection('private').doc('contact').get() : Promise.resolve(null),
    ]);
    const u = user.data() || {};
    const c = priv?.data() || {};
    return {
        name: c.name || u.name || '',
        phone: c.phone || u.phone || '',
        lineId: c.lineId || undefined,
        email: u.email || undefined,
    };
}
