'use server';

/**
 * ลิงก์ชำระเงินงานล่ามที่แอดมินส่งให้ลูกค้าในแชทซัพพอร์ต
 *
 * ขั้นตอน: ลูกค้าส่งคำขอ (interpreter-request-actions.ts) → คุยกับแอดมิน → แอดมินสร้าง
 * interpreterPaymentLinks/{id} ใน lawslane-admin แล้วส่งลิงก์ /interpreter-payment/{id} ในแชท
 * → ลูกค้าโอน + แนบสลิป (SlipOK เหมือนเดิม) → สร้าง interpreterBookings ตามโมเดลเดิม
 * (หัก GP จาก settings/interpreterFees · payout ล่ามผ่านหน้าเดิมใน lawslane-admin)
 *
 * interpreterPaymentLinks อ่าน/เขียนผ่าน Admin SDK เท่านั้น (rules catch-all ปิดไว้)
 * ลูกค้าเห็นได้เฉพาะลิงก์ของตัวเอง (customerId = uid ที่ล็อกอิน)
 */

import * as admin from 'firebase-admin';
import { requireUser } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { readSlipVerificationInTx } from '@/lib/slip-verification';
import { computeOfferQuote } from '@/lib/interpreter-pricing';
import { readGpPercent } from '@/lib/interpreter-public';
import { NotificationService } from '@/services/notification-service';
import { formatSatang, serviceKind, type InterpreterService } from '@/lib/interpreter-types';
import { getPlatformPaymentAccountAction } from '@/app/actions/interpreter-booking-actions';

const LINKS = 'interpreterPaymentLinks';
const HOUR_MS = 60 * 60 * 1000;

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

export interface PaymentLinkView {
    id: string;
    title: string;
    amountBaht: number;
    interpreterName: string;
    service: string;
    languageFrom: string;
    languageTo: string;
    date: string;
    notes: string;
    status: 'open' | 'paid' | 'pending_review' | 'cancelled' | 'expired';
    ticketId: string;
    expiresAt: string | null;
}

function str(v: unknown, max: number): string {
    return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function toView(id: string, d: FirebaseFirestore.DocumentData): PaymentLinkView {
    const expiresAt = d.expiresAt?.toDate ? d.expiresAt.toDate() : null;
    const expired = d.status === 'open' && expiresAt && expiresAt.getTime() < Date.now();
    return {
        id,
        title: String(d.title || ''),
        amountBaht: Number(d.amountBaht) || 0,
        interpreterName: String(d.interpreterName || ''),
        service: String(d.service || ''),
        languageFrom: String(d.languageFrom || ''),
        languageTo: String(d.languageTo || ''),
        date: String(d.date || ''),
        notes: String(d.notes || ''),
        status: expired ? 'expired' : d.status,
        ticketId: String(d.ticketId || ''),
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
    };
}

/** ลิงก์ของลูกค้าที่ล็อกอินอยู่ — ของคนอื่นตอบเหมือนไม่มี */
export async function getInterpreterPaymentLinkAction(linkId: string): Promise<PaymentLinkView | null> {
    const id = str(linkId, 64);
    if (!id || id.includes('/')) return null;
    const { uid, adminApp } = await requireUser();
    const snap = await adminApp.firestore().collection(LINKS).doc(id).get();
    const d = snap.data();
    if (!snap.exists || !d || d.customerId !== uid) return null;
    return toView(snap.id, d);
}

export async function payInterpreterPaymentLinkAction(
    linkId: string,
    payment: { slipUrl: string; slipVerificationId?: string | null; contactName: string; contactPhone: string },
): Promise<Result<{ status: 'paid' | 'pending_review' }>> {
    try {
        const id = str(linkId, 64);
        if (!id || id.includes('/')) return { ok: false, error: 'ไม่พบลิงก์ชำระเงิน' };
        const { uid, adminApp } = await requireUser();
        const db = adminApp.firestore();

        const limit = await checkRateLimit(`interpreter-payment-link:${uid}`, 10, HOUR_MS);
        if (!limit.success) return { ok: false, error: 'ทำรายการถี่เกินไป กรุณาลองใหม่ภายหลัง' };
        if (!(await getPlatformPaymentAccountAction())) return { ok: false, error: 'ระบบชำระเงินยังไม่พร้อม' };

        const slipUrl = str(payment?.slipUrl, 200);
        if (!slipUrl.startsWith('base64_slip_')) return { ok: false, error: 'กรุณาแนบสลิปการโอนเงิน' };
        const contactName = str(payment.contactName, 100);
        const contactPhone = str(payment.contactPhone, 30);
        if (!contactName) return { ok: false, error: 'กรุณากรอกชื่อผู้ติดต่อ' };
        if (!/^[0-9+\-\s()]{8,30}$/.test(contactPhone)) return { ok: false, error: 'เบอร์โทรไม่ถูกต้อง' };

        const linkRef = db.collection(LINKS).doc(id);
        const bookingRef = db.collection('interpreterBookings').doc();

        const outcome = await db.runTransaction(async (tx) => {
            const snap = await tx.get(linkRef);
            const link = snap.data();
            if (!snap.exists || !link || link.customerId !== uid) throw new Error('ไม่พบลิงก์ชำระเงิน');
            if (link.status !== 'open') throw new Error('ลิงก์นี้ชำระแล้วหรือถูกยกเลิก');
            if (link.expiresAt?.toMillis?.() < Date.now()) throw new Error('ลิงก์นี้หมดอายุแล้ว กรุณาติดต่อทีมงาน');

            const gp = await readGpPercent(db, tx);
            const q = computeOfferQuote(String(link.title), Number(link.amountBaht), gp);
            if (!q.ok) throw new Error(q.error);
            const quote = q.quote;

            const slip = await readSlipVerificationInTx(tx, db, uid, payment.slipVerificationId, quote.grossAmount / 100);

            // ---- เขียน ----
            slip.commit();
            const status = slip.verified ? 'paid' : 'pending_payment';
            const service = String(link.service) as InterpreterService;
            tx.set(bookingRef, {
                customerId: uid,
                interpreterId: link.interpreterId,
                interpreterUserId: link.interpreterUserId,
                interpreterName: link.interpreterName,
                kind: serviceKind(service),
                serviceType: service,
                languagePair: { from: link.languageFrom, to: link.languageTo },
                unitType: 'offer',
                rateItemId: null,
                offerId: null,
                paymentLinkId: id,
                ticketId: link.ticketId,
                // วันเวลา/สถานที่แอดมินนัดกับลูกค้าในแชท — ไม่ล็อกปฏิทินล่ามจากลิงก์นี้
                startAt: null,
                endAt: null,
                durationHours: null,
                days: null,
                mode: null,
                province: null,
                address: null,
                pageCount: null,
                certified: service === 'certified_translation',
                dueDate: null,
                documentPaths: [],
                notes: [link.date ? `วันที่: ${link.date}` : '', link.notes || ''].filter(Boolean).join('\n') || null,
                lawyerId: link.lawyerId || null,
                slotIds: [],
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
                holdUntil: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            tx.set(bookingRef.collection('private').doc('contact'), { name: contactName, phone: contactPhone, lineId: null });
            tx.update(linkRef, {
                status: slip.verified ? 'paid' : 'pending_review',
                bookingId: bookingRef.id,
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { status, quote, link };
        });

        // ---- แจ้งเตือน (พลาดไม่ทำให้การจ่ายพัง) ----
        try {
            const now = admin.firestore.FieldValue.serverTimestamp();
            const amountText = formatSatang(outcome.quote.grossAmount);
            const paid = outcome.status === 'paid';
            if (outcome.link.ticketId) {
                await db.collection('tickets').doc(String(outcome.link.ticketId)).collection('messages').add({
                    text: paid
                        ? `ชำระเงินแล้ว ${amountText} บาท (ตรวจสลิปผ่าน) — ${outcome.link.title}`
                        : `แนบสลิปแล้ว ${amountText} บาท รอทีมงานตรวจ — ${outcome.link.title}`,
                    senderId: uid,
                    senderName: contactName,
                    role: 'user',
                    createdAt: now,
                    avatarUrl: null,
                });
            }
            await db.collection('notifications').add({
                type: 'interpreter_payment',
                title: paid ? 'ลูกค้าชำระค่าล่ามแล้ว' : 'สลิปงานล่ามรอตรวจ',
                message: `ยอด ${amountText} บาท — ${outcome.link.title}`,
                createdAt: now,
                read: false,
                recipient: 'admin',
                link: `/interpreter-bookings/${bookingRef.id}`,
                relatedId: bookingRef.id,
            });
            if (paid) {
                await db.collection('notifications').add({
                    type: 'interpreter_booking',
                    title: 'งานล่ามใหม่',
                    message: 'ลูกค้าชำระเงินแล้ว กรุณารับงานหรือปฏิเสธ',
                    createdAt: now,
                    read: false,
                    recipient: outcome.link.interpreterUserId,
                    link: '/interpreter-dashboard',
                    relatedId: bookingRef.id,
                });
            } else {
                await NotificationService.notifyAdminInterpreterSlip(bookingRef.id, amountText);
            }
        } catch (err) {
            console.error('payment link notification failed:', err);
        }

        return { ok: true, status: outcome.status === 'paid' ? 'paid' : 'pending_review' };
    } catch (e: any) {
        const msg = e instanceof Error && /[ก-๙]/.test(e.message) ? e.message : 'ชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
        return { ok: false, error: msg };
    }
}
