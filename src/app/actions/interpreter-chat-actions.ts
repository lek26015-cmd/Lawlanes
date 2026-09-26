'use server';

/**
 * แชทระหว่างลูกค้ากับล่าม — 1 ห้องต่อคู่ (ลูกค้า, ล่าม) ใช้ได้ตั้งแต่ก่อนจอง
 *
 * กติกาหลัก: ก่อนลูกค้าจ่ายเงินให้ล่ามคนนี้ ห้ามทั้งสองฝ่ายเห็นเบอร์ / LINE ID ของกัน
 *   - ข้อความถูกปิดข้อมูลติดต่อฝั่ง server ก่อนบันทึก (maskContactInfo) — ต้นฉบับเก็บไว้
 *     ให้แอดมินตรวจ ไม่ส่งให้คู่สนทนา
 *   - พอมีงานที่ยืนยันการชำระเงินแล้ว (CONTACT_UNLOCK_STATUSES) ข้อความใหม่ไม่ถูกปิด
 *     และหน้าแชทแสดงข้อมูลติดต่อของอีกฝ่าย
 *
 * อ่าน/เขียนผ่าน Admin SDK เท่านั้น (rules ของ interpreterConversations เป็นแอดมินล้วน)
 * หน้าเว็บดึงข้อความใหม่ด้วยการ poll action นี้ — ไม่พึ่ง Firebase Auth ฝั่ง browser
 * (ดูกรณี SSO ที่ client ยังไม่ล็อกอินใน ForInterpretersClient)
 *
 * ตัวตนผู้ใช้มาจาก session เสมอ — ผู้ร่วมห้องตรวจจากเอกสารห้อง ไม่ใช่จากค่าที่ส่งมา
 */

import * as admin from 'firebase-admin';
import { requireUser, AuthError } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { customerContact, interpreterContact, latestPaidBooking } from '@/lib/interpreter-public';
import { conversationIdFor, maskContactInfo } from '@/lib/interpreter-chat-utils';
import { computeOfferQuote } from '@/lib/interpreter-pricing';
import { bangkokDateHourToDate } from '@/lib/interpreter-time';
import {
    BOOKING_LIMITS,
    CHAT_LIMITS,
    INTERPRETER_LANGUAGE_CODES,
    INTERPRETER_SERVICES,
    OFFER_LIMITS,
    type InterpreterOffer,
    type InterpreterChatMessage,
    type InterpreterConversationDetail,
    type InterpreterConversationSummary,
} from '@/lib/interpreter-types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

class ChatError extends Error {}

const NOTIFY_EVERY_MS = 10 * 60 * 1000;

function fail(e: unknown, fallback: string): { ok: false; error: string } {
    if (e instanceof ChatError) return { ok: false, error: e.message };
    if (e instanceof AuthError) return { ok: false, error: e.status === 401 ? 'กรุณาเข้าสู่ระบบก่อน' : 'ไม่มีสิทธิ์เข้าห้องนี้' };
    console.error(fallback, e);
    return { ok: false, error: fallback };
}

const iso = (v: any): string | null => (v?.toDate ? v.toDate().toISOString() : null);

type Room = {
    ref: FirebaseFirestore.DocumentReference;
    data: FirebaseFirestore.DocumentData;
    viewerRole: 'customer' | 'interpreter' | 'admin';
};

async function loadRoom(db: FirebaseFirestore.Firestore, uid: string, isAdmin: boolean, conversationId: string): Promise<Room> {
    if (!conversationId || conversationId.includes('/')) throw new ChatError('ไม่พบห้องแชท');
    const ref = db.collection('interpreterConversations').doc(conversationId);
    const snap = await ref.get();
    const data = snap.data();
    if (!snap.exists || !data) throw new ChatError('ไม่พบห้องแชท');
    if (data.customerId === uid) return { ref, data, viewerRole: 'customer' };
    if (data.interpreterUserId === uid) return { ref, data, viewerRole: 'interpreter' };
    if (isAdmin) return { ref, data, viewerRole: 'admin' };
    throw new AuthError('Forbidden', 403);
}

/** ลูกค้าเปิดห้องคุยกับล่าม (หรือได้ห้องเดิมถ้าเคยคุยแล้ว) */
export async function startInterpreterConversationAction(interpreterId: string): Promise<Result<{ conversationId: string }>> {
    try {
        const { uid, adminApp } = await requireUser();
        const db = adminApp.firestore();
        if (!interpreterId || interpreterId.includes('/')) throw new ChatError('ไม่พบล่าม');
        const profile = (await db.collection('interpreterProfiles').doc(interpreterId).get()).data();
        if (!profile || profile.status !== 'approved') throw new ChatError('ไม่พบล่าม หรือล่ามยังไม่เปิดรับงาน');
        const interpreterUserId = profile.userId || interpreterId;
        if (interpreterUserId === uid) throw new ChatError('ไม่สามารถแชทกับตัวเองได้');

        const conversationId = conversationIdFor(uid, interpreterId);
        const ref = db.collection('interpreterConversations').doc(conversationId);
        await db.runTransaction(async tx => {
            if ((await tx.get(ref)).exists) return;
            const user = (await tx.get(db.collection('users').doc(uid))).data() || {};
            tx.create(ref, {
                customerId: uid,
                customerName: user.name || '',
                interpreterId,
                interpreterUserId,
                interpreterName: profile.name || '',
                interpreterImageUrl: profile.imageUrl || '',
                lastMessage: '',
                lastMessageAt: null,
                customerUnread: 0,
                interpreterUnread: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        return { ok: true, conversationId };
    } catch (e) {
        return fail(e, 'เปิดห้องแชทไม่สำเร็จ');
    }
}

function toSummary(id: string, d: FirebaseFirestore.DocumentData, viewerRole: 'customer' | 'interpreter'): InterpreterConversationSummary {
    return {
        id,
        viewerRole,
        interpreterId: d.interpreterId,
        otherName: viewerRole === 'customer' ? d.interpreterName || '' : d.customerName || '',
        otherImageUrl: viewerRole === 'customer' ? d.interpreterImageUrl || '' : '',
        lastMessage: d.lastMessage || '',
        lastMessageAt: iso(d.lastMessageAt),
        unread: (viewerRole === 'customer' ? d.customerUnread : d.interpreterUnread) || 0,
    };
}

/** ห้องแชทของผู้ใช้ — as: 'customer' (แดชบอร์ดลูกค้า) หรือ 'interpreter' (แดชบอร์ดล่าม) */
export async function listMyInterpreterConversationsAction(as: 'customer' | 'interpreter'): Promise<InterpreterConversationSummary[]> {
    try {
        const { uid, adminApp } = await requireUser();
        const field = as === 'customer' ? 'customerId' : 'interpreterUserId';
        const snap = await adminApp.firestore()
            .collection('interpreterConversations')
            .where(field, '==', uid)
            .orderBy('lastMessageAt', 'desc')
            .limit(50)
            .get();
        return JSON.parse(JSON.stringify(
            snap.docs
                .filter(d => d.data().lastMessageAt) // ห้องที่เปิดแต่ยังไม่มีใครพิมพ์ ไม่ต้องแสดง
                .map(d => toSummary(d.id, d.data(), as))
        ));
    } catch (e) {
        console.error('listMyInterpreterConversationsAction failed:', e);
        return [];
    }
}

/** ข้อความในห้อง + สถานะเปิดเผยข้อมูลติดต่อ · เรียกซ้ำเป็นระยะเพื่อดึงข้อความใหม่ และนับว่าอ่านแล้ว */
export async function getInterpreterConversationAction(conversationId: string): Promise<Result<{ conversation: InterpreterConversationDetail }>> {
    try {
        const { uid, token, adminApp } = await requireUser();
        const db = adminApp.firestore();
        const isAdmin = token.admin === true || token.role === 'admin';
        const room = await loadRoom(db, uid, isAdmin, conversationId);
        const d = room.data;

        const [paid, msgSnap, offerSnap] = await Promise.all([
            latestPaidBooking(db, d.customerId, d.interpreterId),
            room.ref.collection('messages').orderBy('createdAt', 'desc').limit(CHAT_LIMITS.pageSize).get(),
            room.ref.collection('offers').orderBy('createdAt', 'desc').limit(50).get(),
        ]);
        const offers = new Map(offerSnap.docs.map(o => [o.id, toOffer(o.id, o.data())]));
        const unlocked = !!paid;

        let contact = null;
        if (unlocked && room.viewerRole === 'customer') contact = await interpreterContact(db, d.interpreterId);
        if (unlocked && room.viewerRole === 'interpreter') contact = await customerContact(db, d.customerId, paid!.ref);

        const messages: InterpreterChatMessage[] = msgSnap.docs.reverse().map(m => {
            const x = m.data();
            return {
                id: m.id,
                ...(x.offerId && offers.has(x.offerId) ? { offer: offers.get(x.offerId) } : {}),
                mine: x.senderId === uid,
                senderRole: x.senderRole,
                text: x.text,
                masked: x.masked === true,
                createdAt: iso(x.createdAt),
            };
        });

        if (room.viewerRole !== 'admin') {
            const unreadField = room.viewerRole === 'customer' ? 'customerUnread' : 'interpreterUnread';
            if (d[unreadField]) await room.ref.update({ [unreadField]: 0 });
        }

        const viewerRole = room.viewerRole === 'admin' ? 'customer' : room.viewerRole;
        return {
            ok: true,
            conversation: JSON.parse(JSON.stringify({
                ...toSummary(room.ref.id, d, viewerRole),
                unread: 0,
                unlocked,
                contact,
                messages,
            })),
        };
    } catch (e) {
        return fail(e, 'โหลดแชทไม่สำเร็จ');
    }
}

export async function sendInterpreterMessageAction(conversationId: string, text: string): Promise<Result<{ masked: boolean }>> {
    try {
        const { uid, adminApp } = await requireUser();
        const db = adminApp.firestore();
        const room = await loadRoom(db, uid, false, conversationId);
        if (room.viewerRole === 'admin') throw new ChatError('แอดมินส่งข้อความในห้องนี้ไม่ได้');

        const raw = typeof text === 'string' ? text.trim() : '';
        if (!raw) throw new ChatError('กรุณาพิมพ์ข้อความ');
        if (raw.length > CHAT_LIMITS.maxLength) throw new ChatError(`ข้อความยาวเกิน ${CHAT_LIMITS.maxLength} ตัวอักษร`);

        const limit = await checkRateLimit(`interpreter-chat:${uid}`, 30, 60 * 1000);
        if (!limit.success) throw new ChatError('ส่งข้อความถี่เกินไป กรุณารอสักครู่');

        if (room.viewerRole === 'interpreter') {
            const p = (await db.collection('interpreterProfiles').doc(room.data.interpreterId).get()).data();
            if (p?.status !== 'approved') throw new ChatError('บัญชีล่ามของคุณยังไม่เปิดใช้งาน');
        }

        // ยังไม่จ่ายเงิน = ปิดข้อมูลติดต่อในข้อความ (เก็บต้นฉบับไว้ให้แอดมินตรวจเท่านั้น)
        const unlocked = !!(await latestPaidBooking(db, room.data.customerId, room.data.interpreterId));
        const { text: safeText, masked } = unlocked ? { text: raw, masked: false } : maskContactInfo(raw);

        const now = admin.firestore.FieldValue.serverTimestamp();
        const otherUnread = room.viewerRole === 'customer' ? 'interpreterUnread' : 'customerUnread';
        const otherNotifiedAt = room.viewerRole === 'customer' ? 'interpreterNotifiedAt' : 'customerNotifiedAt';
        const shouldNotify = (room.data[otherNotifiedAt]?.toMillis?.() ?? 0) < Date.now() - NOTIFY_EVERY_MS;

        const batch = db.batch();
        batch.set(room.ref.collection('messages').doc(), {
            senderId: uid,
            senderRole: room.viewerRole,
            text: safeText,
            originalText: masked ? raw : null,
            masked,
            createdAt: now,
        });
        batch.update(room.ref, {
            lastMessage: safeText.slice(0, 120),
            lastMessageAt: now,
            [otherUnread]: admin.firestore.FieldValue.increment(1),
            ...(shouldNotify ? { [otherNotifiedAt]: now } : {}),
        });
        if (shouldNotify) {
            const toInterpreter = room.viewerRole === 'customer';
            batch.set(db.collection('notifications').doc(), {
                type: 'interpreter_chat',
                title: toInterpreter ? 'มีข้อความใหม่จากลูกค้า' : 'ล่ามตอบกลับแล้ว',
                message: safeText.slice(0, 100),
                createdAt: now,
                read: false,
                recipient: toInterpreter ? room.data.interpreterUserId : room.data.customerId,
                link: `/interpreter-chat/${room.ref.id}`,
                relatedId: room.ref.id,
            });
        }
        await batch.commit();
        return { ok: true, masked };
    } catch (e) {
        return fail(e, 'ส่งข้อความไม่สำเร็จ');
    }
}

// ---------------------------------------------------------------------------
// ใบเสนอราคาเฉพาะราย (ล่ามส่งในแชท → ลูกค้ากดจ่ายจากใบนั้นที่หน้าจอง ?offer=)
// ---------------------------------------------------------------------------

function toOffer(id: string, o: FirebaseFirestore.DocumentData): InterpreterOffer {
    const expired = o.status === 'open' && (o.expiresAt?.toMillis?.() ?? 0) < Date.now();
    return {
        id,
        title: o.title,
        description: o.description || '',
        amount: o.amount,
        service: o.service,
        languageFrom: o.languageFrom,
        languageTo: o.languageTo,
        date: o.date ?? null,
        startHour: o.startHour ?? null,
        hours: o.hours ?? null,
        // ใบที่หมดอายุแสดงเป็นยกเลิก (หน้าจองตรวจ expiresAt ซ้ำอยู่แล้ว)
        status: expired ? 'cancelled' : o.status,
        expiresAt: iso(o.expiresAt),
        bookingId: o.bookingId ?? null,
    };
}

export type InterpreterOfferInput = {
    title: string;
    description?: string;
    amount: number;
    service: string;
    languageFrom: string;
    languageTo: string;
    date?: string;
    startHour?: number;
    hours?: number;
};

/** ล่ามส่งใบเสนอราคาในห้อง — ราคาเหมาก้อนเดียว จะระบุวันเวลาเพื่อล็อกปฏิทินด้วยก็ได้ */
export async function createInterpreterOfferAction(conversationId: string, input: InterpreterOfferInput): Promise<Result<{ offerId: string }>> {
    try {
        const { uid, adminApp } = await requireUser();
        const db = adminApp.firestore();
        const room = await loadRoom(db, uid, false, conversationId);
        if (room.viewerRole !== 'interpreter') throw new ChatError('เฉพาะล่ามที่ส่งใบเสนอราคาได้');
        const profile = (await db.collection('interpreterProfiles').doc(room.data.interpreterId).get()).data();
        if (profile?.status !== 'approved') throw new ChatError('บัญชีล่ามของคุณยังไม่เปิดใช้งาน');

        const limit = await checkRateLimit(`interpreter-offer:${uid}`, 20, 60 * 60 * 1000);
        if (!limit.success) throw new ChatError('ส่งใบเสนอราคาถี่เกินไป');

        const title = typeof input?.title === 'string' ? input.title.trim().slice(0, 100) : '';
        if (!title) throw new ChatError('กรุณาตั้งหัวข้อใบเสนอราคา');
        const description = typeof input.description === 'string' ? input.description.trim().slice(0, 1000) : '';
        const amount = Math.round(Number(input.amount) * 100) / 100;
        const q = computeOfferQuote(title, amount, 0);
        if (!q.ok) throw new ChatError(q.error);
        if (!(INTERPRETER_SERVICES as readonly string[]).includes(input.service) || !profile.services?.includes(input.service)) {
            throw new ChatError('กรุณาเลือกบริการที่คุณรับ');
        }
        const codes: string[] = profile.languageCodes || [];
        if (!(INTERPRETER_LANGUAGE_CODES as readonly string[]).includes(input.languageFrom) || !codes.includes(input.languageFrom)
            || !codes.includes(input.languageTo) || input.languageFrom === input.languageTo) {
            throw new ChatError('คู่ภาษาไม่ถูกต้อง');
        }

        let schedule: { date: string; startHour: number; hours: number } | null = null;
        if (input.date) {
            const hours = Number(input.hours);
            const startHour = Number(input.startHour);
            const start = bangkokDateHourToDate(String(input.date).slice(0, 10), startHour);
            if (!start || !Number.isInteger(hours) || hours < 1 || hours > BOOKING_LIMITS.maxHours) throw new ChatError('วันเวลาในใบเสนอราคาไม่ถูกต้อง');
            if (start.getTime() < Date.now() + BOOKING_LIMITS.minLeadHours * 60 * 60 * 1000) {
                throw new ChatError(`วันงานต้องห่างจากตอนนี้อย่างน้อย ${BOOKING_LIMITS.minLeadHours} ชั่วโมง`);
            }
            schedule = { date: String(input.date).slice(0, 10), startHour, hours };
        }

        // ข้อความในใบเสนอราคาก็ต้องไม่มีข้อมูลติดต่อก่อนจ่ายเงิน
        const safeTitle = maskContactInfo(title).text;
        const safeDescription = maskContactInfo(description).text;

        const offerRef = room.ref.collection('offers').doc();
        const now = admin.firestore.FieldValue.serverTimestamp();
        const batch = db.batch();
        batch.set(offerRef, {
            title: safeTitle,
            description: safeDescription,
            amount,
            service: input.service,
            languageFrom: input.languageFrom,
            languageTo: input.languageTo,
            date: schedule?.date ?? null,
            startHour: schedule?.startHour ?? null,
            hours: schedule?.hours ?? null,
            status: 'open',
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + OFFER_LIMITS.validDays * 24 * 60 * 60 * 1000),
            createdBy: uid,
            createdAt: now,
        });
        batch.set(room.ref.collection('messages').doc(), {
            senderId: uid,
            senderRole: 'interpreter',
            text: `ใบเสนอราคา: ${safeTitle}`,
            offerId: offerRef.id,
            masked: false,
            createdAt: now,
        });
        batch.update(room.ref, {
            lastMessage: `ใบเสนอราคา: ${safeTitle}`.slice(0, 120),
            lastMessageAt: now,
            customerUnread: admin.firestore.FieldValue.increment(1),
            customerNotifiedAt: now,
        });
        batch.set(db.collection('notifications').doc(), {
            type: 'interpreter_offer',
            title: 'ล่ามส่งใบเสนอราคา',
            message: `${safeTitle} · ฿${amount.toLocaleString('th-TH')}`,
            createdAt: now,
            read: false,
            recipient: room.data.customerId,
            link: `/interpreter-chat/${room.ref.id}`,
            relatedId: offerRef.id,
        });
        await batch.commit();
        return { ok: true, offerId: offerRef.id };
    } catch (e) {
        return fail(e, 'ส่งใบเสนอราคาไม่สำเร็จ');
    }
}

export async function cancelInterpreterOfferAction(conversationId: string, offerId: string): Promise<Result> {
    try {
        const { uid, adminApp } = await requireUser();
        const db = adminApp.firestore();
        const room = await loadRoom(db, uid, false, conversationId);
        if (room.viewerRole !== 'interpreter') throw new ChatError('เฉพาะล่ามที่ยกเลิกใบเสนอราคาได้');
        if (!offerId || offerId.includes('/')) throw new ChatError('ไม่พบใบเสนอราคา');
        const ref = room.ref.collection('offers').doc(offerId);
        await db.runTransaction(async tx => {
            const o = (await tx.get(ref)).data();
            if (!o) throw new ChatError('ไม่พบใบเสนอราคา');
            if (o.status !== 'open') throw new ChatError('ใบเสนอราคานี้ถูกชำระหรือยกเลิกไปแล้ว');
            tx.update(ref, { status: 'cancelled', cancelledAt: admin.firestore.FieldValue.serverTimestamp() });
        });
        return { ok: true };
    } catch (e) {
        return fail(e, 'ยกเลิกใบเสนอราคาไม่สำเร็จ');
    }
}

/** ใบเสนอราคาสำหรับหน้าจอง — เฉพาะลูกค้าของห้องนั้น */
export async function getInterpreterOfferAction(interpreterId: string, offerId: string): Promise<InterpreterOffer | null> {
    try {
        const { uid, adminApp } = await requireUser();
        if (!interpreterId || interpreterId.includes('/') || !offerId || offerId.includes('/')) return null;
        const ref = adminApp.firestore().collection('interpreterConversations').doc(conversationIdFor(uid, interpreterId)).collection('offers').doc(offerId);
        const snap = await ref.get();
        return snap.exists ? JSON.parse(JSON.stringify(toOffer(snap.id, snap.data()!))) : null;
    } catch {
        return null;
    }
}
