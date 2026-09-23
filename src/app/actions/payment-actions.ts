'use server';

import * as admin from 'firebase-admin';
import { initAdmin } from '@/lib/firebase-admin';
import { requireUser, AuthError } from '@/lib/auth-guard';
import { consumeSlipVerification } from '@/lib/slip-verification';

/**
 * คำนวณยอดที่ต้องชำระฝั่ง server — อย่าเชื่อตัวเลขใดๆ จากเบราว์เซอร์
 *
 * ปัญหาเดิมในหน้า /payment:
 *   1. `fee` ของการชำระแบบ case / installment / additional อ่านจาก query param
 *      (`?amount=...`) ตรงๆ → ตั้ง `?amount=1` แล้วจ่าย 1 บาทได้
 *   2. ส่วนลดคูปองตรวจและคำนวณฝั่ง client ทั้งหมด แล้ว `finalFee = fee - discount`
 *      ถูกเขียนลง Firestore เป็นยอดที่ชำระ → แก้ discountAmount ใน devtools
 *      แล้วยอดเป็น 0 ได้ทั้งที่ไม่ได้จ่าย
 *   3. การเช็ค "ยอดในสลิปตรงกับยอดที่ต้องชำระไหม" เทียบกับ finalFee ที่ client
 *      คุมเอง การตรวจจึงไม่มีความหมาย
 *
 * ทุกตัวเลขที่ใช้ตัดสินใจเรื่องเงินต้องมาจากฟังก์ชันนี้เท่านั้น
 */

export type PaymentType = 'chat' | 'appointment' | 'case' | 'installment' | 'additional';

export type ResolvedPrice = {
    ok: true;
    baseFee: number;
    discount: number;
    finalAmount: number;
    couponId: string | null;
    couponLabel: string | null;
} | {
    ok: false;
    error: string;
};

// ค่าบริการมาตรฐานของแพลตฟอร์ม — เก็บฝั่ง server เท่านั้น
const CHAT_TICKET_FEE = 500;
const APPOINTMENT_FEE = 3500;

export async function resolvePaymentAmount(input: {
    paymentType: PaymentType;
    chatId?: string;
    installmentIndex?: number;
    couponCode?: string;
}): Promise<ResolvedPrice> {
    try {
        const { uid } = await requireUser();
        const app = await initAdmin();
        if (!app) return { ok: false, error: 'ระบบยังไม่พร้อม' };
        const db = app.firestore();

        // ---------- 1) ยอดตั้งต้น ----------
        let baseFee: number;

        if (input.paymentType === 'chat') {
            baseFee = CHAT_TICKET_FEE;
        } else if (input.paymentType === 'appointment') {
            baseFee = APPOINTMENT_FEE;
        } else {
            // case / installment / additional — ยอดต้องมาจากเอกสารใน Firestore
            // ไม่ใช่จาก URL และผู้เรียกต้องเป็นคู่กรณีในห้องนั้นจริง
            if (!input.chatId) return { ok: false, error: 'ไม่พบรายการที่ต้องชำระ' };

            const chatSnap = await db.collection('chats').doc(input.chatId).get();
            if (!chatSnap.exists) return { ok: false, error: 'ไม่พบรายการที่ต้องชำระ' };

            const chat = chatSnap.data()!;
            const participants: string[] = chat.participants ?? [];
            if (!participants.includes(uid)) {
                return { ok: false, error: 'ไม่มีสิทธิ์ชำระเงินรายการนี้' };
            }

            if (input.paymentType === 'installment') {
                const installments = chat.installments;
                const i = input.installmentIndex;
                if (!Array.isArray(installments) || i === undefined || !installments[i]) {
                    return { ok: false, error: 'ไม่พบงวดที่ระบุ' };
                }
                if (installments[i].status === 'paid') {
                    return { ok: false, error: 'งวดนี้ชำระแล้ว' };
                }
                baseFee = Number(installments[i].amount) || 0;
            } else {
                baseFee = Number(chat.amount ?? chat.quotedAmount ?? 0);
            }
        }

        if (!Number.isFinite(baseFee) || baseFee < 0) {
            return { ok: false, error: 'ยอดชำระไม่ถูกต้อง' };
        }

        // ---------- 2) คูปอง ----------
        let discount = 0;
        let couponId: string | null = null;
        let couponLabel: string | null = null;

        const code = input.couponCode?.trim().toUpperCase();
        if (code) {
            const snap = await db.collection('coupons')
                .where('code', '==', code)
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (snap.empty) return { ok: false, error: 'รหัสคูปองไม่ถูกต้องหรือหมดอายุ' };

            const doc = snap.docs[0];
            const c = doc.data();

            const expiry = c.expiryDate?.toDate?.();
            if (expiry && expiry < new Date()) return { ok: false, error: 'คูปองนี้หมดอายุแล้ว' };

            if (c.usageLimit && (c.usedCount ?? 0) >= c.usageLimit) {
                return { ok: false, error: 'คูปองนี้ถูกใช้จนครบจำนวนสิทธิ์แล้ว' };
            }

            discount = c.type === 'percent'
                ? (baseFee * Number(c.value || 0)) / 100
                : Number(c.value || 0);

            // ส่วนลดห้ามเกินยอด และปัดเป็นสตางค์
            discount = Math.min(Math.max(0, Math.round(discount * 100) / 100), baseFee);
            couponId = doc.id;
            couponLabel = c.code ?? code;
        }

        return {
            ok: true,
            baseFee,
            discount,
            finalAmount: Math.max(0, Math.round((baseFee - discount) * 100) / 100),
            couponId,
            couponLabel,
        };
    } catch (e) {
        if (e instanceof AuthError) return { ok: false, error: e.message };
        console.error('resolvePaymentAmount failed:', e);
        return { ok: false, error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' };
    }
}

/**
 * ตัดสิทธิ์คูปอง 1 ครั้ง — ต้องทำฝั่ง server
 *
 * เดิม client ยิง updateDoc(coupons/{id}, { usedCount: increment(1) }) เอง
 * ซึ่งหลัง deploy firestore.rules ชุดใหม่ (coupons เขียนได้เฉพาะแอดมิน) จะถูก
 * ปฏิเสธเงียบๆ → usedCount ไม่เคยเพิ่ม คูปองใช้ซ้ำได้ไม่จำกัด
 *
 * ใช้ transaction เพื่อไม่ให้ยิงพร้อมกันแล้วเกิน usageLimit
 */
export async function redeemCoupon(couponId: string): Promise<{ ok: boolean; error?: string }> {
    try {
        await requireUser();
        const app = await initAdmin();
        if (!app) return { ok: false, error: 'ระบบยังไม่พร้อม' };
        const db = app.firestore();
        const ref = db.collection('coupons').doc(couponId);

        await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) throw new Error('ไม่พบคูปอง');
            const c = snap.data()!;
            const used = c.usedCount ?? 0;
            if (c.usageLimit && used >= c.usageLimit) throw new Error('คูปองถูกใช้ครบแล้ว');
            tx.update(ref, { usedCount: used + 1 });
        });

        return { ok: true };
    } catch (e) {
        console.error('redeemCoupon failed:', e);
        return { ok: false, error: e instanceof Error ? e.message : 'ตัดสิทธิ์คูปองไม่สำเร็จ' };
    }
}


/**
 * สร้างเอกสาร Ticket สนทนาพร้อมยอดชำระ — ต้องทำฝั่ง server
 *
 * เดิม client ทำ setDoc(chats/{id}, { amount: finalFee, ... }) เอง
 * ต่อให้ยอดที่แสดงมาจาก server แล้ว คนที่ตั้งใจโกงก็ยังเปิด console ยิง SDK
 * เขียน amount เป็นเท่าไรก็ได้ เพราะ firestore.rules ของ chats เป็น
 * `allow create: if isSignedIn()` ตัวนี้จึงคิดยอดใหม่ฝั่ง server แล้วเขียนเอง
 * ด้วย Admin SDK ไม่รับยอดจากผู้เรียกเลย
 */
export async function createConsultationChat(input: {
    lawyerId: string;
    lawyerUserId: string;
    initialMessage: string;
    slipUrl?: string | null;
    slipVerificationId?: string | null;
    couponCode?: string;
}): Promise<{ ok: true; chatId: string } | { ok: false; error: string }> {
    try {
        const { uid } = await requireUser();
        const app = await initAdmin();
        if (!app) return { ok: false, error: 'ระบบยังไม่พร้อม' };
        const db = app.firestore();

        if (!input.lawyerUserId) return { ok: false, error: 'ไม่พบทนายความปลายทาง' };

        // คิดยอดใหม่ฝั่ง server ไม่รับตัวเลขใดๆ จากผู้เรียก
        const price = await resolvePaymentAmount({ paymentType: 'chat', couponCode: input.couponCode });
        if (!price.ok) return { ok: false, error: price.error };

        // สลิปที่ผ่าน SlipOK จริงเท่านั้นที่ถือว่าจ่ายแล้ว ที่เหลือรอแอดมินตรวจ
        // เดิมเชื่อ `!!input.slipOkData` ที่ client ส่งมา → ยิง action พร้อมก้อนปลอมก็ผ่าน
        const { verified, slipData } = await consumeSlipVerification(
            db, uid, input.slipVerificationId, price.finalAmount
        );
        const chatRef = db.collection('chats').doc();

        await chatRef.set({
            participants: [uid, input.lawyerUserId],
            createdAt: new Date(),
            caseTitle: `Ticket สนทนา: ${input.initialMessage.substring(0, 30)}...`,
            status: verified ? 'paid' : 'pending_payment',
            slipUrl: input.slipUrl ?? null,
            slipOkData: slipData,
            lawyerId: input.lawyerId,
            userId: uid,
            lastMessage: input.initialMessage,
            lastMessageAt: new Date(),
            amount: price.finalAmount,
            originalFee: price.baseFee,
            discount: price.discount,
            couponCode: price.couponLabel,
            hasNewPayment: !verified,
        });

        await chatRef.collection('messages').add({
            text: input.initialMessage,
            senderId: uid,
            timestamp: new Date(),
        });

        if (price.couponId) {
            const redeemed = await redeemCoupon(price.couponId);
            if (!redeemed.ok) console.error('redeemCoupon failed:', redeemed.error);
        }

        return { ok: true, chatId: chatRef.id };
    } catch (e) {
        if (e instanceof AuthError) return { ok: false, error: e.message };
        console.error('createConsultationChat failed:', e);
        return { ok: false, error: 'สร้างรายการไม่สำเร็จ' };
    }
}


/**
 * สร้างนัดหมายพร้อมยอดชำระ — ต้องทำฝั่ง server
 *
 * เดิม client ยิง addDoc(appointments, { amount: finalFee, status, ... }) เอง
 * และ firestore.rules ของ appointments เป็น `allow create: if isSignedIn()`
 * แปลว่าใครก็เปิด console สร้างนัดหมายพร้อม `amount: 0, status: 'paid'` ได้
 * โดยไม่ต้องผ่านหน้าเว็บเลย → ทนายเห็นว่าจ่ายแล้วและลงมือทำงานฟรี
 */
export async function createAppointment(input: {
    lawyerId: string;
    lawyerUserId: string;
    appointmentDate: string;
    description?: string | null;
    slipUrl?: string | null;
    slipVerificationId?: string | null;
    couponCode?: string;
}): Promise<{ ok: true; appointmentId: string } | { ok: false; error: string }> {
    try {
        const { uid } = await requireUser();
        const app = await initAdmin();
        if (!app) return { ok: false, error: 'ระบบยังไม่พร้อม' };
        const db = app.firestore();

        if (!input.lawyerId) return { ok: false, error: 'ไม่พบทนายความปลายทาง' };

        const when = new Date(input.appointmentDate);
        if (Number.isNaN(when.getTime())) return { ok: false, error: 'วันเวลานัดหมายไม่ถูกต้อง' };

        // คิดยอดใหม่ฝั่ง server ไม่รับตัวเลขใดๆ จากผู้เรียก
        const price = await resolvePaymentAmount({ paymentType: 'appointment', couponCode: input.couponCode });
        if (!price.ok) return { ok: false, error: price.error };

        // สลิปที่ผ่าน SlipOK จริงเท่านั้นที่ถือว่าจ่ายแล้ว ที่เหลือรอแอดมินตรวจ
        const { verified, slipData } = await consumeSlipVerification(
            db, uid, input.slipVerificationId, price.finalAmount
        );

        const lawyerSnap = await db.collection('lawyerProfiles').doc(input.lawyerId).get();
        const lawyer = lawyerSnap.data() ?? {};

        const ref = db.collection('appointments').doc();
        await ref.set({
            userId: uid,
            lawyerId: input.lawyerId,
            lawyerUserId: lawyer.userId ?? input.lawyerUserId ?? null,
            lawyerName: lawyer.name ?? '',
            appointmentDate: when,
            description: input.description ?? null,
            status: verified ? 'paid' : 'pending_payment',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            slipUrl: input.slipUrl ?? null,
            slipOkData: slipData,
            amount: price.finalAmount,
            originalFee: price.baseFee,
            discount: price.discount,
            couponCode: price.couponLabel,
            hasNewPayment: !verified,
        });

        if (price.couponId) {
            const redeemed = await redeemCoupon(price.couponId);
            if (!redeemed.ok) console.error('redeemCoupon failed:', redeemed.error);
        }

        return { ok: true, appointmentId: ref.id };
    } catch (e) {
        if (e instanceof AuthError) return { ok: false, error: e.message };
        console.error('createAppointment failed:', e);
        return { ok: false, error: 'สร้างนัดหมายไม่สำเร็จ' };
    }
}
