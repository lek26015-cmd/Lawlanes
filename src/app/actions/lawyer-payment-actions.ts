'use server';

import * as admin from 'firebase-admin';
import { requireChatRole, AuthError } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { readSlipVerificationInTx } from '@/lib/slip-verification';
import { getPlatformPaymentAccountAction } from '@/app/actions/interpreter-booking-actions';
import {
    LAWYER_PAYMENTS,
    LawyerPaymentRejected,
    applyPaidInTx,
    bahtToSatang,
    dueLabel,
    listOutstanding,
    pickDue,
    postPaidEffects,
    readLawyerGpPercent,
    splitGp,
    type LawyerPaymentDue,
    type LawyerPaymentType,
} from '@/lib/lawyer-payment-core';

/**
 * ลูกความจ่ายค่าทนายเข้าบัญชีระบบ (LAWSLANE-PLAN-10) — ดูภาพรวมที่ lib/lawyer-payment-core.ts
 *
 *   1. หน้า /payment แสดงยอดค้าง (อ่านจากเอกสารห้อง ไม่รับจาก URL) + บัญชีระบบ
 *   2. ลูกความโอน → แนบสลิป → payLawyerFeeAction
 *      - SlipOK ผ่าน (ตั๋วผลตรวจ + ยอดตรง + สลิปไม่ซ้ำ) → รายการเป็นจ่ายแล้วทันที
 *      - ไม่ผ่าน → lawyerPayments.status = 'pending_review' รอแอดมินตรวจที่ lawslane-admin /lawyer-payments
 *   3. ทนายไม่ต้องยืนยันรับเงินอีก — confirmDirectPaymentReceivedAction เหลือไว้เฉพาะรายการที่
 *      ลูกความแจ้งโอนตรงให้ทนายไว้ก่อนเปลี่ยนระบบ (เงินอาจอยู่ในบัญชีทนายแล้ว)
 */

export type LawyerPaymentInfo = {
    chatId: string;
    role: 'client' | 'lawyer' | 'admin';
    caseTitle: string;
    lawyer: { profileId: string; name: string; imageUrl: string };
    /** บัญชีระบบ — null = ยังไม่ได้ตั้ง env ปิดการชำระเงิน */
    account: { bankName: string; accountNumber: string; accountName: string } | null;
    due: LawyerPaymentDue | null;
    outstanding: LawyerPaymentDue[];
};

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function authError(e: unknown, fallback: string): { ok: false; error: string } {
    if (e instanceof AuthError) return { ok: false, error: e.status === 404 ? 'ไม่พบห้องสนทนา' : 'ไม่มีสิทธิ์ทำรายการนี้' };
    if (e instanceof LawyerPaymentRejected) return { ok: false, error: e.message };
    console.error(fallback, e);
    return { ok: false, error: fallback };
}

export async function getLawyerPaymentInfoAction(
    chatId: string,
    want?: { type?: LawyerPaymentType; installmentIndex?: number },
): Promise<Result<{ data: LawyerPaymentInfo }>> {
    try {
        if (!chatId || typeof chatId !== 'string') return { ok: false, error: 'ไม่พบห้องสนทนา' };
        const { role, chatData, adminApp } = await requireChatRole(chatId);
        const db = adminApp.firestore();
        const profileId: string = chatData.lawyerId || chatData.lawyer_id || '';
        const lp = profileId ? (await db.collection('lawyerProfiles').doc(profileId).get()).data() || {} : {};
        const outstanding = listOutstanding(chatData);
        return {
            ok: true,
            data: {
                chatId,
                role,
                caseTitle: chatData.caseTitle || '',
                lawyer: { profileId, name: lp.name || 'ทนายความ', imageUrl: lp.imageUrl || '' },
                account: await getPlatformPaymentAccountAction(),
                due: pickDue(outstanding, want),
                outstanding,
            },
        };
    } catch (e) {
        return authError(e, 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    }
}

/**
 * ลูกความแนบสลิปค่าทนายที่โอนเข้าบัญชีระบบ
 * slipUrl ต้องเป็นรูปที่ผู้เรียกอัปเองผ่าน saveBase64SlipAction (`base64_slip_{id}`) เท่านั้น
 */
export async function payLawyerFeeAction(input: {
    chatId: string;
    type: LawyerPaymentType;
    installmentIndex?: number;
    slipUrl: string;
    slipVerificationId?: string | null;
}): Promise<Result<{ status: 'paid' | 'pending_review' }>> {
    try {
        const { uid, role, adminApp } = await requireChatRole(input.chatId);
        if (role !== 'client') return { ok: false, error: 'เฉพาะลูกความของเคสนี้เท่านั้นที่ชำระได้' };
        if (!['case', 'installment', 'additional'].includes(input.type)) return { ok: false, error: 'ประเภทรายการไม่ถูกต้อง' };

        const limit = await checkRateLimit(`lawyer-payment:${uid}`, 10, 60 * 60 * 1000);
        if (!limit.success) return { ok: false, error: 'ทำรายการถี่เกินไป กรุณาลองใหม่ภายหลัง' };
        if (!(await getPlatformPaymentAccountAction())) return { ok: false, error: 'ระบบชำระเงินยังไม่พร้อม กรุณาติดต่อทีมงาน' };

        const db = adminApp.firestore();
        const m = typeof input.slipUrl === 'string' ? input.slipUrl.match(/^base64_slip_([A-Za-z0-9]+)$/) : null;
        if (!m) return { ok: false, error: 'กรุณาแนบสลิปการโอนเงิน' };
        const img = await db.collection('slipImages').doc(m[1]).get();
        if (!img.exists || img.data()?.uploadedBy !== uid) return { ok: false, error: 'ไฟล์สลิปไม่ถูกต้อง' };

        const chatRef = db.collection('chats').doc(input.chatId);
        const paymentRef = db.collection(LAWYER_PAYMENTS).doc();

        const outcome = await db.runTransaction(async (tx) => {
            const snap = await tx.get(chatRef);
            if (!snap.exists) throw new LawyerPaymentRejected('ไม่พบห้องสนทนา');
            const chat = snap.data()!;
            const due = pickDue(listOutstanding(chat), { type: input.type, installmentIndex: input.installmentIndex });
            if (!due || due.type !== input.type || (input.type === 'installment' && due.installmentIndex !== input.installmentIndex)) {
                throw new LawyerPaymentRejected('ไม่พบรายการที่ต้องชำระ หรือรายการนี้ชำระแล้ว');
            }
            if (due.pendingReview) throw new LawyerPaymentRejected('แนบสลิปรายการนี้แล้ว กำลังรอทีมงานตรวจ');
            if (due.amount <= 0) throw new LawyerPaymentRejected('รายการนี้ยังไม่มียอดค่าบริการ');

            const gpPercent = await readLawyerGpPercent(db, tx);
            const slip = await readSlipVerificationInTx(tx, db, uid, input.slipVerificationId, due.amount);
            const lawyerProfileId: string = chat.lawyerId || chat.lawyer_id || '';
            const lp = lawyerProfileId ? (await tx.get(db.collection('lawyerProfiles').doc(lawyerProfileId))).data() || {} : {};

            // ---- เขียน (อ่านครบแล้ว) ----
            slip.commit();
            const grossAmount = bahtToSatang(due.amount);
            const { gpAmount, netToLawyer } = splitGp(grossAmount, gpPercent);
            const ts = admin.firestore.FieldValue.serverTimestamp();
            const paid = slip.verified;
            tx.set(paymentRef, {
                chatId: input.chatId,
                caseTitle: chat.caseTitle || '',
                clientId: uid,
                lawyerProfileId,
                lawyerUserId: lp.userId || '',
                lawyerName: lp.name || '',
                type: due.type,
                installmentIndex: due.type === 'installment' ? due.installmentIndex : null,
                description: due.description,
                grossAmount,
                gpPercent,
                gpAmount,
                netToLawyer,
                currency: 'THB',
                slipUrl: input.slipUrl,
                slipOkData: slip.slipData,
                slipVerified: paid,
                status: paid ? 'paid' : 'pending_review',
                // ถือไว้จนทนายปิดเคส · ปิดเคสแล้ว (เช่น ค่าเพิ่มเติมตอนปิดเคส) = รอโอนให้ทนายเลย
                payoutStatus: paid ? (chat.status === 'closed' ? 'due' : 'held') : 'none',
                createdAt: ts,
                updatedAt: ts,
                ...(paid ? { paidAt: ts } : {}),
            });

            if (paid) {
                const applied = applyPaidInTx(chat, due, { confirmedBy: 'slipok', confirmedByRole: 'platform', paymentId: paymentRef.id });
                tx.update(chatRef, applied.update);
                return { chat, paid, amount: applied.amount, label: applied.label, firstPaid: applied.firstPaid };
            }
            // จองรายการไว้ระหว่างรอตรวจ กันลูกความจ่ายซ้ำ
            const label = dueLabel(due.type, due.installmentIndex);
            const update: Record<string, any> = {
                updatedAt: ts,
                lastMessageAt: ts,
                lastMessage: `🧾 ลูกความแนบสลิป${label} ฿${due.amount.toLocaleString()} แล้ว — รอทีมงาน Lawslane ตรวจ`,
            };
            if (due.type === 'installment') {
                const installments = [...chat.installments];
                installments[due.installmentIndex!] = { ...installments[due.installmentIndex!], platformPaymentId: paymentRef.id };
                update.installments = installments;
            } else {
                update.platformPaymentPending = { type: due.type, paymentId: paymentRef.id };
            }
            tx.update(chatRef, update);
            return { chat, paid, amount: due.amount, label, firstPaid: false };
        });

        if (outcome.paid) {
            await postPaidEffects(db, input.chatId, outcome, 'platform');
        } else {
            const ts = admin.firestore.FieldValue.serverTimestamp();
            await chatRef.collection('messages').add({
                chatId: input.chatId,
                text: `🧾 ลูกความแนบสลิป${outcome.label} ฿${outcome.amount.toLocaleString()} เข้าบัญชี Lawslane แล้ว ทีมงานกำลังตรวจสลิป`,
                senderId: 'system',
                senderName: 'ระบบแจ้งเตือน',
                timestamp: ts,
                type: 'payment_notice',
                metadata: { amount: outcome.amount, paymentType: input.type, installmentIndex: input.installmentIndex ?? null, paymentId: paymentRef.id },
            }).catch(err => console.error('payment message failed:', err));
            await db.collection('notifications').add({
                type: 'lawyer_payment',
                title: 'สลิปค่าทนายรอตรวจ',
                message: `${outcome.chat.caseTitle || 'เคส'} — ${outcome.label} ฿${outcome.amount.toLocaleString()}`,
                createdAt: ts,
                read: false,
                recipient: 'admin',
                link: `/lawyer-payments/${paymentRef.id}`,
                relatedId: paymentRef.id,
            }).catch(err => console.error('admin notification failed:', err));
        }
        return { ok: true, status: outcome.paid ? 'paid' : 'pending_review' };
    } catch (e) {
        return authError(e, 'ชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
}

/**
 * ยืนยันรับเงินโอนตรงแบบเดิม — ใช้ได้เฉพาะรายการที่ลูกความแจ้งโอนให้ทนายไว้ก่อนเปลี่ยนเป็นจ่ายผ่านระบบ
 * (เงินอยู่ในบัญชีทนายแล้ว ไม่มี GP ไม่เข้าคิวโอนให้ทนาย) · แอดมินยืนยันได้ทุกรายการ (กรณีพิเศษ)
 */
export async function confirmDirectPaymentReceivedAction(input: {
    chatId: string;
    type: LawyerPaymentType;
    installmentIndex?: number;
}): Promise<Result> {
    try {
        const { uid, role, adminApp } = await requireChatRole(input.chatId);
        if (role !== 'lawyer' && role !== 'admin') return { ok: false, error: 'เฉพาะทนายความของเคสนี้เท่านั้นที่ยืนยันรับเงินได้' };
        const db = adminApp.firestore();
        const chatRef = db.collection('chats').doc(input.chatId);
        const outcome = await db.runTransaction(async (tx) => {
            const snap = await tx.get(chatRef);
            if (!snap.exists) throw new LawyerPaymentRejected('ไม่พบห้องสนทนา');
            const chat = snap.data()!;
            const due = pickDue(listOutstanding(chat), { type: input.type, installmentIndex: input.installmentIndex });
            if (!due || due.type !== input.type) throw new LawyerPaymentRejected('ไม่พบรายการนี้ หรือชำระแล้ว');
            if (due.pendingReview) throw new LawyerPaymentRejected('ลูกความแนบสลิปเข้าระบบแล้ว รอทีมงานตรวจ');
            if (role === 'lawyer' && !due.legacyNotice) {
                throw new LawyerPaymentRejected('ค่าบริการชำระผ่านบัญชี Lawslane แล้ว ไม่ต้องยืนยันรับเงินเอง');
            }
            const applied = applyPaidInTx(chat, due, { confirmedBy: uid, confirmedByRole: role });
            tx.update(chatRef, applied.update);
            return { chat, amount: applied.amount, label: applied.label, firstPaid: applied.firstPaid };
        });
        await postPaidEffects(db, input.chatId, outcome, role);
        return { ok: true };
    } catch (e) {
        return authError(e, 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
}
