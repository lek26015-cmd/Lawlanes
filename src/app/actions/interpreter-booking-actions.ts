'use server';

/**
 * จองล่าม / ชำระเงิน / ล่ามรับงาน / ปิดงาน
 *
 * โมเดลเงิน: ลูกค้าโอนเข้าบัญชีแพลตฟอร์ม (สลิป + SlipOK) → แพลตฟอร์มหัก GP แล้วโอนให้ล่าม
 * ภายหลังผ่านหน้า payout ใน lawslane-admin · GP % และราคาถูก snapshot ลง booking ตอนจอง
 * แก้ GP ทีหลังไม่กระทบงานเก่า
 *
 * กันจองชน: งานล่ามพูดจอง slot รายชั่วโมง interpreterSlots/{id}_{YYYYMMDD}_{HH} (เวลาไทย)
 * ใน transaction เดียวกับการสร้าง booking — slot ที่ถูกถือโดยงานที่ยังไม่จ่ายและหมดเวลา
 * hold แล้ว ถือว่าว่าง (งานนั้นถูกเปลี่ยนเป็น expired ใน transaction เดียวกัน)
 *
 * โค้ดชุดนี้จงใจไม่ใช้ payment-actions.ts / PaymentType / คูปอง (branch
 * refactor/remove-platform-money จะลบส่วนนั้น) ใช้แค่ lib/slip-verification.ts ร่วม
 *
 * firestore.rules: interpreterBookings / interpreterSlots เขียนได้เฉพาะ Admin SDK
 */

import * as admin from 'firebase-admin';
import { requireUser, requireInterpreter, AuthError } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { readSlipVerificationInTx } from '@/lib/slip-verification';
import { computeOfferQuote, computeRateQuote } from '@/lib/interpreter-pricing';
import { customerContact, interpreterContact, readGpPercent, toPublicInterpreter } from '@/lib/interpreter-public';
import { CONTACT_UNLOCK_STATUSES, conversationIdFor } from '@/lib/interpreter-chat-utils';
import { bangkokDateHourToDate, bangkokParts, parseHourString, slotIdsFor } from '@/lib/interpreter-time';
import { NotificationService } from '@/services/notification-service';
import {
    BOOKING_LIMITS,
    SLOT_HOLDING_STATUSES,
    formatSatang,
    serviceKind,
    type InterpreterBookingInput,
    type InterpreterBookingStatus,
    type InterpreterBookingView,
    type InterpreterQuote,
    type InterpreterService,
    type RateUnit,
} from '@/lib/interpreter-types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

class BookingError extends Error {}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function errorResult(e: unknown, fallback: string): { ok: false; error: string } {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    if (e instanceof AuthError) return { ok: false, error: e.status === 401 ? 'กรุณาเข้าสู่ระบบก่อน' : 'ไม่มีสิทธิ์ทำรายการนี้' };
    console.error(fallback, e);
    return { ok: false, error: fallback };
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const iso = (v: any): string | null => (v?.toDate ? v.toDate().toISOString() : null);

// ---------------------------------------------------------------------------
// ตรวจคำขอจอง (ไม่แตะ transaction) — ใช้ร่วมกันระหว่าง quote และ create
//
// ราคามาจาก 2 ทาง:
//   - รายการในเรทการ์ดของล่าม (rateItemId) — หน่วยกำหนดวิธีจองและการล็อกปฏิทิน
//   - ใบเสนอราคาที่ล่ามส่งในแชท (offerId) — ราคา/บริการ/วันเวลา มาจากใบนั้นทั้งหมด
// ---------------------------------------------------------------------------

type ValidatedBooking = {
    interpreterId: string;
    interpreterUserId: string;
    interpreterName: string;
    input: InterpreterBookingInput;
    service: InterpreterService;
    languageFrom: InterpreterBookingInput['languageFrom'];
    languageTo: InterpreterBookingInput['languageTo'];
    kind: 'interpretation' | 'translation';
    unit: RateUnit | 'offer';
    rateItemId: string | null;
    offerRef: FirebaseFirestore.DocumentReference | null;
    /** ราคาจริงคิดใน transaction ด้วย GP ณ ตอนนั้น */
    quoteWith: (gpPercent: number) => ReturnType<typeof computeRateQuote>;
    startAt: Date | null;
    endAt: Date | null;
    durationHours: number | null;
    days: number | null;
    pageCount: number | null;
    mode: 'onsite' | 'remote' | null;
    slotIds: string[];
    dueDate: string | null;
    documentPaths: string[];
};

type Profile = ReturnType<typeof toPublicInterpreter>;

/** ตรวจช่วงเวลาทำงานกับตารางของล่าม — ใช้ทีละวันสำหรับงานหลายวัน */
function checkDayWindow(profile: Profile, start: Date, hours: number) {
    if (start.getTime() < Date.now() + BOOKING_LIMITS.minLeadHours * HOUR_MS) {
        throw new BookingError(`ต้องจองล่วงหน้าอย่างน้อย ${BOOKING_LIMITS.minLeadHours} ชั่วโมง`);
    }
    if (start.getTime() > Date.now() + BOOKING_LIMITS.maxDaysAhead * DAY_MS) {
        throw new BookingError(`จองล่วงหน้าได้ไม่เกิน ${BOOKING_LIMITS.maxDaysAhead} วัน`);
    }
    const schedule = profile.schedule;
    if (!schedule) return;
    const p = bangkokParts(start);
    if (schedule.availableDays && (schedule.availableDays as any)[p.dayKey] === false) {
        throw new BookingError(`ล่ามไม่รับงานวันที่ ${p.dateKey}`);
    }
    if ((schedule.overrides || []).some(ov => String(ov.date).slice(0, 10) === p.dateKey)) {
        throw new BookingError(`ล่ามไม่รับงานวันที่ ${p.dateKey}`);
    }
    const workStart = parseHourString(schedule.workingHours?.start);
    const workEnd = parseHourString(schedule.workingHours?.end);
    if (workStart !== null && workEnd !== null && (p.hour < workStart || p.hour + hours > workEnd)) {
        throw new BookingError(`ล่ามรับงานเวลา ${schedule.workingHours.start}-${schedule.workingHours.end} น.`);
    }
}

/** เวลาทำงานต่อวันของล่าม (ใช้กับเหมาวัน) — ไม่ได้ตั้งตาราง = 08:00-18:00 */
function workingDay(profile: Profile): { start: number; end: number } {
    const s = parseHourString(profile.schedule?.workingHours?.start);
    const e = parseHourString(profile.schedule?.workingHours?.end);
    return s !== null && e !== null && e > s ? { start: s, end: e } : { start: 8, end: 18 };
}

function checkLocation(profile: Profile, input: InterpreterBookingInput): 'onsite' | 'remote' {
    if (input.mode === 'remote') {
        if (!profile.remoteAvailable) throw new BookingError('ล่ามท่านนี้ไม่รับงานออนไลน์');
        return 'remote';
    }
    if (input.mode === 'onsite') {
        const province = str(input.province, 60);
        if (!province || !profile.serviceProvinces.includes(province)) throw new BookingError('ล่ามไม่รับงานในจังหวัดที่เลือก');
        if (str(input.address, 500).length < 5) throw new BookingError('กรุณาระบุสถานที่');
        return 'onsite';
    }
    throw new BookingError('กรุณาเลือกรูปแบบงาน (ไปที่สถานที่/ออนไลน์)');
}

async function validateBooking(
    db: FirebaseFirestore.Firestore,
    uid: string,
    input: InterpreterBookingInput
): Promise<ValidatedBooking> {
    const interpreterId = str(input?.interpreterId, 128);
    if (!interpreterId || interpreterId.includes('/')) throw new BookingError('ไม่พบล่าม');
    const snap = await db.collection('interpreterProfiles').doc(interpreterId).get();
    const raw = snap.data();
    if (!snap.exists || !raw || raw.status !== 'approved') throw new BookingError('ไม่พบล่าม หรือล่ามยังไม่เปิดรับงาน');
    const interpreterUserId = raw.userId || interpreterId;
    if (interpreterUserId === uid) throw new BookingError('ไม่สามารถจองงานกับตัวเองได้');
    const profile = toPublicInterpreter(snap.id, raw);

    // ---- ที่มาของราคา ----
    let service = input.service;
    let languageFrom = input.languageFrom;
    let languageTo = input.languageTo;
    let unit: RateUnit | 'offer';
    let rateItemId: string | null = null;
    let offerRef: FirebaseFirestore.DocumentReference | null = null;
    let quoteWith: ValidatedBooking['quoteWith'];
    let offerSchedule: { date: string; startHour: number; hours: number } | null = null;

    if (input.offerId) {
        const conversationId = conversationIdFor(uid, interpreterId);
        offerRef = db.collection('interpreterConversations').doc(conversationId).collection('offers').doc(str(input.offerId, 64));
        const offer = (await offerRef.get()).data();
        if (!offer) throw new BookingError('ไม่พบใบเสนอราคา');
        if (offer.status !== 'open') throw new BookingError('ใบเสนอราคานี้ใช้ไม่ได้แล้ว');
        if (offer.expiresAt?.toMillis?.() < Date.now()) throw new BookingError('ใบเสนอราคานี้หมดอายุแล้ว');
        service = offer.service;
        languageFrom = offer.languageFrom;
        languageTo = offer.languageTo;
        unit = 'offer';
        quoteWith = gp => computeOfferQuote(offer.title, offer.amount, gp);
        if (offer.date) offerSchedule = { date: offer.date, startHour: offer.startHour, hours: offer.hours };
    } else {
        const item = profile.rateCard.find(r => r.id === str(input.rateItemId, 40));
        if (!item) throw new BookingError('กรุณาเลือกรายการจากเรทการ์ดของล่าม');
        if (item.services.length && !item.services.includes(input.service)) throw new BookingError(`"${item.name}" ใช้กับบริการนี้ไม่ได้`);
        unit = item.unit;
        rateItemId = item.id;
        quoteWith = gp => computeRateQuote(item, input.quantity, gp);
    }

    if (!profile.services.includes(service)) throw new BookingError('ล่ามท่านนี้ไม่รับบริการประเภทนี้');
    if (languageFrom === languageTo) throw new BookingError('ภาษาต้นทางและปลายทางต้องต่างกัน');
    if (!profile.languageCodes.includes(languageFrom) || !profile.languageCodes.includes(languageTo)) {
        throw new BookingError('ล่ามท่านนี้ไม่รองรับคู่ภาษาที่เลือก');
    }
    const kind = serviceKind(service);

    // ตรวจจำนวน/ราคาก่อน (GP ใดก็ได้ในช่วง) เพื่อให้ข้อความ error ขึ้นก่อนเรื่องวันเวลา
    const pre = quoteWith(0);
    if (!pre.ok) throw new BookingError(pre.error);

    // ---- วันเวลา + ล็อกปฏิทิน ----
    let startAt: Date | null = null;
    let endAt: Date | null = null;
    let durationHours: number | null = null;
    let days: number | null = null;
    let slotIds: string[] = [];

    const scheduledHours =
        unit === 'hour' ? Number(input.quantity)
        : unit === 'session' ? profile.rateCard.find(r => r.id === rateItemId)!.sessionHours
        : unit === 'offer' && offerSchedule ? offerSchedule.hours
        : null;

    if (scheduledHours !== null) {
        const date = unit === 'offer' ? offerSchedule!.date : str(input.date, 10);
        const hour = unit === 'offer' ? offerSchedule!.startHour : Number(input.startHour);
        startAt = bangkokDateHourToDate(date, hour);
        if (!startAt) throw new BookingError('วันเวลาไม่ถูกต้อง');
        checkDayWindow(profile, startAt, scheduledHours);
        durationHours = scheduledHours;
        endAt = new Date(startAt.getTime() + scheduledHours * HOUR_MS);
        slotIds = slotIdsFor(interpreterId, startAt, scheduledHours);
    } else if (unit === 'day') {
        days = Number(input.quantity);
        const wd = workingDay(profile);
        const first = bangkokDateHourToDate(str(input.date, 10), wd.start);
        if (!first) throw new BookingError('วันที่ไม่ถูกต้อง');
        for (let i = 0; i < days; i++) {
            const dayStart = new Date(first.getTime() + i * DAY_MS);
            checkDayWindow(profile, dayStart, wd.end - wd.start);
            slotIds.push(...slotIdsFor(interpreterId, dayStart, wd.end - wd.start));
        }
        startAt = first;
        endAt = new Date(first.getTime() + (days - 1) * DAY_MS + (wd.end - wd.start) * HOUR_MS);
        durationHours = (wd.end - wd.start) * days;
    }

    // งานล่ามพูดที่มีวันเวลาต้องระบุสถานที่ · เหมาคดี/ใบเสนอราคาที่ไม่มีวัน นัดกันในแชท
    const mode = kind === 'interpretation' && startAt ? checkLocation(profile, input) : null;

    // ---- เอกสาร (งานแปล) ----
    let dueDate: string | null = null;
    if (kind === 'translation' && input.dueDate) {
        const due = bangkokDateHourToDate(str(input.dueDate, 10), 0);
        if (!due) throw new BookingError('วันที่ต้องการรับงานไม่ถูกต้อง');
        if (due.getTime() < Date.now() + DAY_MS) throw new BookingError('วันรับงานต้องเป็นวันพรุ่งนี้เป็นต้นไป');
        if (due.getTime() > Date.now() + BOOKING_LIMITS.maxDaysAhead * DAY_MS) throw new BookingError(`เลือกวันรับงานได้ภายใน ${BOOKING_LIMITS.maxDaysAhead} วัน`);
        dueDate = str(input.dueDate, 10);
    }
    const documentPaths = (Array.isArray(input.documentPaths) ? input.documentPaths : [])
        .map(p => str(p, 300))
        .filter(p => p.startsWith(`interpreter_booking_docs/${uid}/`) && !p.includes('..'))
        .slice(0, 20);
    if (unit === 'page' && documentPaths.length === 0) throw new BookingError('กรุณาอัปโหลดเอกสารที่ต้องการแปล');

    return {
        interpreterId,
        interpreterUserId,
        interpreterName: profile.name,
        input,
        service,
        languageFrom,
        languageTo,
        kind,
        unit,
        rateItemId,
        offerRef,
        quoteWith,
        startAt,
        endAt,
        durationHours,
        days,
        pageCount: unit === 'page' ? Number(input.quantity) : null,
        mode,
        slotIds,
        dueDate,
        documentPaths,
    };
}

// ---------------------------------------------------------------------------
// อ่าน
// ---------------------------------------------------------------------------

/**
 * ชั่วโมงที่ไม่ว่างของล่าม (เวลาไทย) คืนเป็น "YYYY-MM-DD_HH"
 * ไม่ส่งรายละเอียดงานใดๆ — แค่บอกว่าไม่ว่าง
 */
export async function getInterpreterBusyHoursAction(interpreterId: string): Promise<string[]> {
    try {
        const { adminApp } = await requireUser();
        if (!interpreterId || interpreterId.includes('/')) return [];
        const snap = await adminApp.firestore()
            .collection('interpreterSlots')
            .where('interpreterId', '==', interpreterId)
            .get();
        const now = Date.now();
        return snap.docs
            .filter(d => {
                const hold = d.data().holdUntil;
                return !hold || hold.toMillis() > now;
            })
            .map(d => {
                const [, ymd, hh] = d.id.slice(interpreterId.length).split('_');
                return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}_${hh}`;
            });
    } catch {
        return [];
    }
}

/**
 * บัญชีรับเงินของแพลตฟอร์ม — มาจาก env เท่านั้น (repo เป็น public และห้ามใช้บัญชีส่วนตัว)
 * คืน null ถ้ายังไม่ตั้งค่า → หน้าจองปิดการชำระเงิน
 */
export async function getPlatformPaymentAccountAction(): Promise<{
    bankName: string;
    accountNumber: string;
    accountName: string;
} | null> {
    const bankName = process.env.INTERPRETER_PAYMENT_BANK_NAME?.trim();
    const accountNumber = process.env.INTERPRETER_PAYMENT_ACCOUNT_NUMBER?.trim();
    const accountName = process.env.INTERPRETER_PAYMENT_ACCOUNT_NAME?.trim();
    if (!bankName || !accountNumber || !accountName) return null;
    return { bankName, accountNumber, accountName };
}

/** ราคาที่ต้องจ่ายตามคำขอ — ใช้แสดงก่อนจ่าย (ตัวเลขจริงคิดใหม่อีกรอบตอน create) */
export async function quoteInterpreterBookingAction(input: InterpreterBookingInput): Promise<Result<{ quote: InterpreterQuote }>> {
    try {
        const { uid, adminApp } = await requireUser();
        const db = adminApp.firestore();
        const v = await validateBooking(db, uid, input);
        const gp = await readGpPercent(db);
        const q = v.quoteWith(gp);
        if (!q.ok) return { ok: false, error: q.error };
        return { ok: true, quote: q.quote };
    } catch (e) {
        return errorResult(e, 'คำนวณราคาไม่สำเร็จ');
    }
}

// ---------------------------------------------------------------------------
// สร้าง booking + ชำระเงิน
// ---------------------------------------------------------------------------

export async function createInterpreterBookingAction(
    input: InterpreterBookingInput,
    payment: { slipUrl: string; slipVerificationId?: string | null }
): Promise<Result<{ bookingId: string; status: InterpreterBookingStatus }>> {
    try {
        const { uid, adminApp } = await requireUser();
        const db = adminApp.firestore();

        const limit = await checkRateLimit(`interpreter-booking:${uid}`, 10, HOUR_MS);
        if (!limit.success) return { ok: false, error: 'ทำรายการถี่เกินไป กรุณาลองใหม่ภายหลัง' };
        if (!(await getPlatformPaymentAccountAction())) return { ok: false, error: 'ระบบชำระเงินยังไม่พร้อม' };

        const slipUrl = str(payment?.slipUrl, 200);
        if (!slipUrl.startsWith('base64_slip_')) return { ok: false, error: 'กรุณาแนบสลิปการโอนเงิน' };

        // ข้อมูลติดต่อของลูกค้า — ล่ามเห็นได้หลังยืนยันการชำระเงินแล้วเท่านั้น
        // เก็บใน subcollection private (rules: แอดมินเท่านั้น) เพราะล่ามอ่านเอกสาร booking ได้เองตั้งแต่ยังไม่จ่าย
        const contactName = str(input.contactName, 100);
        const contactPhone = str(input.contactPhone, 30);
        const contactLineId = str(input.contactLineId, 50);
        if (!contactName) return { ok: false, error: 'กรุณากรอกชื่อผู้ติดต่อ' };
        if (!/^[0-9+\-\s()]{8,30}$/.test(contactPhone)) return { ok: false, error: 'เบอร์โทรไม่ถูกต้อง' };

        const v = await validateBooking(db, uid, input);

        let lawyerId: string | null = null;
        const rawLawyerId = str(input.lawyerId, 128);
        if (rawLawyerId && !rawLawyerId.includes('/')) {
            const l = await db.collection('lawyerProfiles').doc(rawLawyerId).get();
            if (l.exists && l.data()?.status === 'approved') lawyerId = rawLawyerId;
        }

        const bookingRef = db.collection('interpreterBookings').doc();
        const slotRefs = v.slotIds.map(id => db.collection('interpreterSlots').doc(id));

        const result = await db.runTransaction(async (tx) => {
            // ---- อ่านทั้งหมดก่อน (Firestore บังคับ) ----
            const gp = await readGpPercent(db, tx);
            const q = v.quoteWith(gp);
            if (!q.ok) throw new BookingError(q.error);
            const quote = q.quote;

            // ใบเสนอราคาใช้ได้ครั้งเดียว — กันกดจ่ายซ้ำ/สองแท็บพร้อมกัน
            if (v.offerRef) {
                const offer = await tx.get(v.offerRef);
                if (offer.data()?.status !== 'open') throw new BookingError('ใบเสนอราคานี้ใช้ไม่ได้แล้ว');
            }

            const slotSnaps = await Promise.all(slotRefs.map(r => tx.get(r)));
            const now = Date.now();
            const staleBookingIds = new Set<string>();
            for (const s of slotSnaps) {
                if (!s.exists) continue;
                const hold = s.data()!.holdUntil;
                if (!hold || hold.toMillis() > now) throw new BookingError('ช่วงเวลานี้มีผู้จองแล้ว กรุณาเลือกเวลาอื่น');
                staleBookingIds.add(s.data()!.bookingId);
            }
            const staleSnaps = await Promise.all(
                [...staleBookingIds].map(id => tx.get(db.collection('interpreterBookings').doc(id)))
            );

            const slip = await readSlipVerificationInTx(tx, db, uid, payment.slipVerificationId, quote.grossAmount / 100);

            // ---- เขียน ----
            slip.commit();
            if (v.offerRef) tx.update(v.offerRef, { status: 'booked', bookingId: bookingRef.id, bookedAt: admin.firestore.FieldValue.serverTimestamp() });
            for (const s of staleSnaps) {
                if (s.exists && s.data()!.status === 'pending_payment') {
                    tx.update(s.ref, { status: 'expired', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                }
            }
            const holdUntil = slip.verified
                ? null
                : admin.firestore.Timestamp.fromMillis(now + BOOKING_LIMITS.holdMinutes * 60 * 1000);
            for (const ref of slotRefs) {
                tx.set(ref, { interpreterId: v.interpreterId, bookingId: bookingRef.id, holdUntil });
            }

            const status: InterpreterBookingStatus = slip.verified ? 'paid' : 'pending_payment';
            tx.set(bookingRef, {
                customerId: uid,
                interpreterId: v.interpreterId,
                interpreterUserId: v.interpreterUserId,
                interpreterName: v.interpreterName,
                kind: v.kind,
                serviceType: v.service,
                languagePair: { from: v.languageFrom, to: v.languageTo },
                unitType: v.unit,
                rateItemId: v.rateItemId,
                offerId: v.offerRef?.id ?? null,
                startAt: v.startAt ? admin.firestore.Timestamp.fromDate(v.startAt) : null,
                endAt: v.endAt ? admin.firestore.Timestamp.fromDate(v.endAt) : null,
                durationHours: v.durationHours,
                days: v.days,
                mode: v.mode,
                province: v.mode === 'onsite' ? str(input.province, 60) : null,
                address: v.mode === 'onsite' ? str(input.address, 500) : null,
                pageCount: v.pageCount,
                certified: v.service === 'certified_translation',
                dueDate: v.dueDate,
                documentPaths: v.documentPaths,
                notes: str(input.notes, 2000) || null,
                lawyerId,
                slotIds: v.slotIds,
                quote,
                grossAmount: quote.grossAmount,
                netToInterpreter: quote.netToInterpreter,
                currency: 'THB',
                slipUrl,
                slipOkData: slip.slipData,
                slipVerified: slip.verified,
                hasNewPayment: !slip.verified,
                status,
                payoutStatus: 'not_due',
                holdUntil,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            tx.set(bookingRef.collection('private').doc('contact'), {
                name: contactName,
                phone: contactPhone,
                lineId: contactLineId || null,
            });
            return { status, quote };
        });

        await notifyAfterPayment(db, bookingRef.id, v, result.status, result.quote);
        return { ok: true, bookingId: bookingRef.id, status: result.status };
    } catch (e) {
        return errorResult(e, 'จองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
}

async function notifyAfterPayment(
    db: FirebaseFirestore.Firestore,
    bookingId: string,
    v: ValidatedBooking,
    status: InterpreterBookingStatus,
    quote: InterpreterQuote
) {
    try {
        const now = admin.firestore.FieldValue.serverTimestamp();
        if (status === 'paid') {
            await db.collection('notifications').add({
                type: 'interpreter_booking',
                title: 'งานล่ามใหม่',
                message: 'ลูกค้าชำระเงินแล้ว กรุณารับงานหรือปฏิเสธ',
                createdAt: now,
                read: false,
                recipient: v.interpreterUserId,
                link: '/interpreter-dashboard',
                relatedId: bookingId,
            });
            const priv = (await db.collection('interpreterProfiles').doc(v.interpreterId)
                .collection('private').doc('details').get()).data();
            if (priv?.email) {
                await NotificationService.notifyInterpreterNewBooking({
                    email: priv.email,
                    interpreterName: v.interpreterName.replace(/[<>&"']/g, ''),
                    serviceLabel: v.kind === 'translation' ? 'แปลเอกสาร' : 'ล่าม',
                    whenText: v.startAt
                        ? v.startAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })
                        : quote.itemName,
                });
            }
        } else {
            await db.collection('notifications').add({
                type: 'interpreter_payment',
                title: 'สลิปงานล่ามรอตรวจ',
                message: `ยอด ${formatSatang(quote.grossAmount)} บาท`,
                createdAt: now,
                read: false,
                recipient: 'admin',
                link: `/interpreter-bookings/${bookingId}`,
                relatedId: bookingId,
            });
            await NotificationService.notifyAdminInterpreterSlip(bookingId, formatSatang(quote.grossAmount));
        }
    } catch (err) {
        // แจ้งเตือนพลาดไม่ทำให้การจองพัง — booking ถูกสร้างแล้ว
        console.error('interpreter booking notification failed:', err);
    }
}

// ---------------------------------------------------------------------------
// เปลี่ยนสถานะ
// ---------------------------------------------------------------------------

function releaseSlots(tx: FirebaseFirestore.Transaction, db: FirebaseFirestore.Firestore, bookingId: string, slotSnaps: FirebaseFirestore.DocumentSnapshot[]) {
    for (const s of slotSnaps) {
        // ลบเฉพาะ slot ที่ยังเป็นของ booking นี้ — กันลบ slot ที่คนอื่นจองทับหลังหมด hold ไปแล้ว
        if (s.exists && s.data()!.bookingId === bookingId) tx.delete(s.ref);
    }
}

async function readSlotSnaps(tx: FirebaseFirestore.Transaction, db: FirebaseFirestore.Firestore, booking: FirebaseFirestore.DocumentData) {
    const ids: string[] = Array.isArray(booking.slotIds) ? booking.slotIds : [];
    return Promise.all(ids.map(id => tx.get(db.collection('interpreterSlots').doc(id))));
}

/** ล่ามรับงาน / ปฏิเสธ — ได้เฉพาะงานที่ชำระเงินแล้ว · ปฏิเสธ = คืน slot + รอแอดมินคืนเงิน */
export async function respondToInterpreterBookingAction(bookingId: string, accept: boolean, reason?: string): Promise<Result> {
    try {
        const { uid, adminApp } = await requireInterpreter();
        const db = adminApp.firestore();
        const ref = db.collection('interpreterBookings').doc(str(bookingId, 128));
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const b = snap.data();
            if (!snap.exists || !b || b.interpreterId !== uid) throw new BookingError('ไม่พบงานนี้');
            if (b.status !== 'paid') throw new BookingError('งานนี้ไม่อยู่ในสถานะที่รับหรือปฏิเสธได้');
            const slots = accept ? [] : await readSlotSnaps(tx, db, b);
            const ts = admin.firestore.FieldValue.serverTimestamp();
            if (accept) {
                tx.update(ref, { status: 'accepted', acceptedAt: ts, updatedAt: ts });
            } else {
                releaseSlots(tx, db, ref.id, slots);
                tx.update(ref, {
                    status: 'refund_pending',
                    declinedAt: ts,
                    declineReason: str(reason, 500) || null,
                    cancelledBy: 'interpreter',
                    updatedAt: ts,
                });
            }
        });
        await db.collection('notifications').add({
            type: 'interpreter_booking',
            title: accept ? 'ล่ามรับงานแล้ว' : 'ล่ามปฏิเสธงาน',
            message: accept ? 'ล่ามยืนยันรับงานของคุณแล้ว' : 'ล่ามไม่สามารถรับงานนี้ได้ ทีมงานจะติดต่อเรื่องการคืนเงิน',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
            recipient: (await ref.get()).data()?.customerId,
            link: '/dashboard',
            relatedId: ref.id,
        }).catch(() => {});
        if (!accept) {
            await db.collection('notifications').add({
                type: 'interpreter_refund',
                title: 'งานล่ามรอคืนเงิน',
                message: 'ล่ามปฏิเสธงานที่ชำระเงินแล้ว',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
                recipient: 'admin',
                link: `/interpreter-bookings/${ref.id}`,
                relatedId: ref.id,
            }).catch(() => {});
        }
        return { ok: true };
    } catch (e) {
        return errorResult(e, 'บันทึกไม่สำเร็จ');
    }
}

/** ล่ามปิดงาน — งานล่ามพูดต้องเลยเวลาเลิกแล้ว · ยอดสุทธิเข้าคิวรอโอน */
export async function completeInterpreterBookingAction(bookingId: string): Promise<Result> {
    try {
        const { uid, adminApp } = await requireInterpreter();
        const db = adminApp.firestore();
        const ref = db.collection('interpreterBookings').doc(str(bookingId, 128));
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const b = snap.data();
            if (!snap.exists || !b || b.interpreterId !== uid) throw new BookingError('ไม่พบงานนี้');
            if (b.status !== 'accepted') throw new BookingError('ปิดงานได้เฉพาะงานที่รับแล้ว');
            if (b.kind === 'interpretation' && b.endAt && b.endAt.toMillis() > Date.now()) {
                throw new BookingError('ยังไม่ถึงเวลาสิ้นสุดงาน');
            }
            const ts = admin.firestore.FieldValue.serverTimestamp();
            tx.update(ref, { status: 'completed', payoutStatus: 'due', completedAt: ts, updatedAt: ts });
        });
        return { ok: true };
    } catch (e) {
        return errorResult(e, 'ปิดงานไม่สำเร็จ');
    }
}

/**
 * ลูกค้ายกเลิก → 'refund_pending' เสมอ (ทุกการจองแนบสลิปมาแล้ว แอดมินตรวจแล้วคืนเงิน
 * หรือปิดเป็น cancelled ถ้าสลิปไม่จริง) และคืน slot ทันที
 * - ล่ามรับแล้ว → ยกเลิกเองได้ถ้าก่อนเริ่มงานเกิน 48 ชม. ไม่งั้นต้องติดต่อทีมงาน
 */
export async function cancelInterpreterBookingAction(bookingId: string, reason?: string): Promise<Result<{ status: InterpreterBookingStatus }>> {
    try {
        const { uid, adminApp } = await requireUser();
        const db = adminApp.firestore();
        const ref = db.collection('interpreterBookings').doc(str(bookingId, 128));
        const status = await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const b = snap.data();
            if (!snap.exists || !b || b.customerId !== uid) throw new BookingError('ไม่พบงานนี้');
            if (!SLOT_HOLDING_STATUSES.includes(b.status)) throw new BookingError('งานนี้ยกเลิกไม่ได้แล้ว');
            if (b.status === 'accepted') {
                const start = b.startAt?.toMillis?.() ?? null;
                if (b.kind === 'translation' || !start || start - Date.now() < 48 * HOUR_MS) {
                    throw new BookingError('งานนี้ล่ามเริ่มดำเนินการแล้ว กรุณาติดต่อทีมงานเพื่อยกเลิก');
                }
            }
            const slots = await readSlotSnaps(tx, db, b);
            const next: InterpreterBookingStatus = 'refund_pending';
            const ts = admin.firestore.FieldValue.serverTimestamp();
            releaseSlots(tx, db, ref.id, slots);
            tx.update(ref, {
                status: next,
                cancelledBy: 'customer',
                cancelReason: str(reason, 500) || null,
                cancelledAt: ts,
                hasNewPayment: false,
                updatedAt: ts,
            });
            return next;
        });
        return { ok: true, status };
    } catch (e) {
        return errorResult(e, 'ยกเลิกไม่สำเร็จ');
    }
}

// ---------------------------------------------------------------------------
// รายการงาน
// ---------------------------------------------------------------------------

function toView(id: string, b: FirebaseFirestore.DocumentData): InterpreterBookingView {
    return {
        id,
        conversationId: conversationIdFor(b.customerId, b.interpreterId),
        contact: null,
        customerId: b.customerId,
        interpreterId: b.interpreterId,
        interpreterName: b.interpreterName || '',
        kind: b.kind,
        serviceType: b.serviceType,
        languagePair: b.languagePair,
        startAt: iso(b.startAt),
        endAt: iso(b.endAt),
        durationHours: b.durationHours ?? null,
        days: b.days ?? null,
        mode: b.mode ?? null,
        province: b.province ?? null,
        address: b.address ?? null,
        pageCount: b.pageCount ?? null,
        certified: b.certified === true,
        dueDate: b.dueDate ?? null,
        notes: b.notes ?? null,
        lawyerId: b.lawyerId ?? null,
        quote: b.quote,
        status: b.status,
        payoutStatus: b.payoutStatus || 'not_due',
        createdAt: iso(b.createdAt),
    };
}

/** งานล่ามของลูกค้าที่ล็อกอินอยู่ */
export async function getMyInterpreterBookingsAction(): Promise<InterpreterBookingView[]> {
    try {
        const { uid, adminApp } = await requireUser();
        const snap = await adminApp.firestore()
            .collection('interpreterBookings')
            .where('customerId', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        const db = adminApp.firestore();
        const contacts = new Map<string, Promise<Awaited<ReturnType<typeof interpreterContact>>>>();
        const views = await Promise.all(snap.docs.map(async d => {
            const v = toView(d.id, d.data());
            if (CONTACT_UNLOCK_STATUSES.includes(v.status)) {
                if (!contacts.has(v.interpreterId)) contacts.set(v.interpreterId, interpreterContact(db, v.interpreterId));
                v.contact = await contacts.get(v.interpreterId)!;
            }
            return v;
        }));
        return JSON.parse(JSON.stringify(views));
    } catch (e) {
        console.error('getMyInterpreterBookingsAction failed:', e);
        return [];
    }
}

export type InterpreterPayoutView = {
    id: string;
    totalGross: number;
    totalGp: number;
    totalNet: number;
    bookingCount: number;
    paidAt: string | null;
};

/**
 * ข้อมูลแดชบอร์ดล่าม — งานทั้งหมด + ยอดรอโอน + ประวัติการโอน
 * ลูกค้าถูกแสดงแค่ข้อมูลงาน ไม่ส่งข้อมูลติดต่อลูกค้า (ติดต่อผ่านทีมงานในเฟส 1)
 */
export async function getInterpreterDashboardDataAction(): Promise<{
    bookings: InterpreterBookingView[];
    payouts: InterpreterPayoutView[];
    pendingPayoutNet: number;
    paidOutNet: number;
} | null> {
    try {
        const { uid, adminApp } = await requireInterpreter({ allowPending: true });
        const db = adminApp.firestore();
        const [bookingsSnap, payoutsSnap] = await Promise.all([
            db.collection('interpreterBookings').where('interpreterId', '==', uid).orderBy('createdAt', 'desc').limit(100).get(),
            db.collection('interpreterPayouts').where('interpreterId', '==', uid).orderBy('paidAt', 'desc').limit(50).get(),
        ]);
        // ไม่ส่ง uid ลูกค้า · ข้อมูลติดต่อลูกค้าเปิดเฉพาะงานที่จ่ายแล้ว
        const bookings = await Promise.all(bookingsSnap.docs.map(async d => {
            const v = { ...toView(d.id, d.data()), customerId: '' };
            if (CONTACT_UNLOCK_STATUSES.includes(v.status)) {
                v.contact = await customerContact(db, d.data().customerId, d.ref);
            }
            return v;
        }));
        const payouts = payoutsSnap.docs.map(d => {
            const p = d.data();
            return {
                id: d.id,
                totalGross: p.totalGross || 0,
                totalGp: p.totalGp || 0,
                totalNet: p.totalNet || 0,
                bookingCount: Array.isArray(p.bookingIds) ? p.bookingIds.length : 0,
                paidAt: iso(p.paidAt),
            };
        });
        const pendingPayoutNet = bookings
            .filter(b => b.payoutStatus === 'due')
            .reduce((sum, b) => sum + (b.quote?.netToInterpreter || 0), 0);
        const paidOutNet = payouts.reduce((sum, p) => sum + p.totalNet, 0);
        return JSON.parse(JSON.stringify({ bookings, payouts, pendingPayoutNet, paidOutNet }));
    } catch (e) {
        console.error('getInterpreterDashboardDataAction failed:', e);
        return null;
    }
}
