'use server';

import * as admin from 'firebase-admin';
import { initAdmin } from '@/lib/firebase-admin';
import { requireUser, AuthError } from '@/lib/auth-guard';
import { readSlipVerificationInTx } from '@/lib/slip-verification';
import { redeemCouponInTx, CouponRedeemError } from '@/lib/coupon-server';
import { getPendingAdditionalFee } from '@/lib/additional-fee';

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
            } else if (input.paymentType === 'additional') {
                // ค่าบริการเพิ่มเติม = ยอดที่ทนายขอไว้เท่านั้น ไม่ใช่ chat.amount
                // เดิมใช้ chat.amount (ยอดรวมทั้งเคส) เป็นฐาน → ลูกความถูกเรียกเก็บ
                // เท่ายอดเคสเดิมอีกรอบ ทั้งที่ทนายขอเพิ่มแค่ส่วนต่าง
                const requested = getPendingAdditionalFee(chat);
                if (!requested) {
                    return { ok: false, error: 'ไม่พบคำขอชำระค่าบริการเพิ่มเติมจากทนายความ' };
                }
                baseFee = requested.amount;
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

            // เช็คล่วงหน้าเพื่อบอกผู้ใช้เท่านั้น — ตัวชี้ขาดคือ redeemCouponInTx()
            // ที่ตัดสิทธิ์ใน transaction เดียวกับการเขียนรายการ (ยิงพร้อมกันจะผ่านด่านนี้หมด)
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

        const finalAmount = Math.max(0, Math.round((baseFee - discount) * 100) / 100);
        // ยอด 0 ไม่มีสลิปให้ตรวจ → ไม่ขึ้นคิวหลังบ้าน และขั้นอนุมัติก็ปฏิเสธยอด ≤ 0
        // ถ้าปล่อยผ่าน คูปองถูกตัดสิทธิ์ไปแล้วแต่เคสค้าง pending_payment ถาวร
        // (ถ้าจะรองรับคูปองลด 100% ต้องออกแบบให้ server เปิดเคสเองใน transaction)
        if (finalAmount <= 0) {
            return { ok: false, error: 'ยอดชำระต้องมากกว่า 0 บาท — คูปองนี้ใช้ลดจนเหลือ 0 ไม่ได้' };
        }

        return {
            ok: true,
            baseFee,
            discount,
            finalAmount,
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
 * หา uid ของทนายจาก lawyerProfiles ฝั่ง server
 *
 * เดิมรับ lawyerUserId จาก client แล้วใส่ลง participants ตรงๆ → ส่ง uid ใครก็ได้
 * เข้ามา คนนั้นจะได้สิทธิ์อ่านห้องแชท/สลิปของลูกความทั้งที่ไม่ใช่ทนายเจ้าของเคส
 * (ชุดเดียวกับ lawslane-capdeal)
 */
async function resolveLawyerUserId(db: FirebaseFirestore.Firestore, lawyerId: string) {
    if (!lawyerId) return null;
    const snap = await db.collection('lawyerProfiles').doc(lawyerId).get();
    if (!snap.exists) return null;
    const lawyer = snap.data()!;
    if (!lawyer.userId) return null;
    return { userId: lawyer.userId as string, lawyer };
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
    /** @deprecated ไม่ใช้แล้ว — uid ของทนายอ่านจาก lawyerProfiles ฝั่ง server */
    lawyerUserId?: string;
    initialMessage: string;
    slipUrl?: string | null;
    slipVerificationId?: string | null;
    couponCode?: string;
}): Promise<{ ok: true; chatId: string; isAutoApproved: boolean; amount: number } | { ok: false; error: string }> {
    try {
        const { uid } = await requireUser();
        const app = await initAdmin();
        if (!app) return { ok: false, error: 'ระบบยังไม่พร้อม' };
        const db = app.firestore();

        // ทนายปลายทางต้องมีโปรไฟล์จริง และ uid ที่ใส่ใน participants มาจากโปรไฟล์
        // ไม่ใช่ lawyerUserId ที่ client ส่งมา
        const target = await resolveLawyerUserId(db, input.lawyerId);
        if (!target) return { ok: false, error: 'ไม่พบทนายความปลายทาง' };
        if (target.userId === uid) return { ok: false, error: 'ไม่สามารถเปิด Ticket กับตัวเองได้' };

        // คิดยอดใหม่ฝั่ง server ไม่รับตัวเลขใดๆ จากผู้เรียก
        const price = await resolvePaymentAmount({ paymentType: 'chat', couponCode: input.couponCode });
        if (!price.ok) return { ok: false, error: price.error };

        const chatRef = db.collection('chats').doc();
        const firstMessageRef = chatRef.collection('messages').doc();

        // ใช้ตั๋วสลิป + ตัดคูปอง + สร้างห้อง + ข้อความแรก ในก้อนเดียว
        // เดิมทำเครื่องหมายตั๋วว่าใช้แล้วก่อน แล้วค่อยเขียนห้องทีหลัง ถ้าเขียนห้องล้ม
        // ลูกค้าเสียสลิปฟรี และคูปองตัดสิทธิ์ทีหลังแบบ log ทิ้งถ้าไม่สำเร็จ → ยิงพร้อมกัน
        // ได้ส่วนลดเกิน usageLimit ตอนนี้ส่วนไหนล้ม ทั้งก้อนล้ม
        const verified = await db.runTransaction(async (tx) => {
            // สลิปที่ผ่าน SlipOK จริงเท่านั้นที่ถือว่าจ่ายแล้ว ที่เหลือรอแอดมินตรวจ
            // เดิมเชื่อ `!!input.slipOkData` ที่ client ส่งมา → ยิง action พร้อมก้อนปลอมก็ผ่าน
            const slip = await readSlipVerificationInTx(tx, db, uid, input.slipVerificationId, price.finalAmount);
            if (price.couponId) await redeemCouponInTx(tx, db, price.couponId);
            slip.commit();

            tx.set(chatRef, {
                participants: [uid, target.userId],
                createdAt: new Date(),
                caseTitle: `Ticket สนทนา: ${input.initialMessage.substring(0, 30)}...`,
                status: slip.verified ? 'paid' : 'pending_payment',
                slipUrl: input.slipUrl ?? null,
                slipOkData: slip.slipData,
                lawyerId: input.lawyerId,
                userId: uid,
                lastMessage: input.initialMessage,
                lastMessageAt: new Date(),
                amount: price.finalAmount,
                originalFee: price.baseFee,
                discount: price.discount,
                couponCode: price.couponLabel,
                couponId: price.couponId,
                hasNewPayment: !slip.verified,
            });
            tx.set(firstMessageRef, {
                text: input.initialMessage,
                senderId: uid,
                timestamp: new Date(),
            });
            return slip.verified;
        });

        return { ok: true, chatId: chatRef.id, isAutoApproved: verified, amount: price.finalAmount };
    } catch (e) {
        if (e instanceof AuthError) return { ok: false, error: e.message };
        if (e instanceof CouponRedeemError) return { ok: false, error: e.message };
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
    /** @deprecated ไม่ใช้แล้ว — uid ของทนายอ่านจาก lawyerProfiles ฝั่ง server */
    lawyerUserId?: string;
    appointmentDate: string;
    description?: string | null;
    slipUrl?: string | null;
    slipVerificationId?: string | null;
    couponCode?: string;
}): Promise<{ ok: true; appointmentId: string; isAutoApproved: boolean; amount: number } | { ok: false; error: string }> {
    try {
        const { uid } = await requireUser();
        const app = await initAdmin();
        if (!app) return { ok: false, error: 'ระบบยังไม่พร้อม' };
        const db = app.firestore();

        // เดิมโปรไฟล์ไม่มีก็สร้างนัดหมายได้ และ fallback ไปใช้ lawyerUserId จาก client
        const target = await resolveLawyerUserId(db, input.lawyerId);
        if (!target) return { ok: false, error: 'ไม่พบทนายความปลายทาง' };
        if (target.userId === uid) return { ok: false, error: 'ไม่สามารถนัดหมายกับตัวเองได้' };
        const lawyer = target.lawyer;

        const when = new Date(input.appointmentDate);
        if (Number.isNaN(when.getTime())) return { ok: false, error: 'วันเวลานัดหมายไม่ถูกต้อง' };

        // คิดยอดใหม่ฝั่ง server ไม่รับตัวเลขใดๆ จากผู้เรียก
        const price = await resolvePaymentAmount({ paymentType: 'appointment', couponCode: input.couponCode });
        if (!price.ok) return { ok: false, error: price.error };

        const ref = db.collection('appointments').doc();

        // ใช้ตั๋วสลิป + ตัดคูปอง + สร้างนัดหมาย ในก้อนเดียว (เหตุผลเดียวกับ createConsultationChat)
        const verified = await db.runTransaction(async (tx) => {
            // สลิปที่ผ่าน SlipOK จริงเท่านั้นที่ถือว่าจ่ายแล้ว ที่เหลือรอแอดมินตรวจ
            const slip = await readSlipVerificationInTx(tx, db, uid, input.slipVerificationId, price.finalAmount);
            if (price.couponId) await redeemCouponInTx(tx, db, price.couponId);
            slip.commit();

            tx.set(ref, {
                userId: uid,
                lawyerId: input.lawyerId,
                lawyerUserId: target.userId,
                lawyerName: lawyer.name ?? '',
                appointmentDate: when,
                description: input.description ?? null,
                status: slip.verified ? 'paid' : 'pending_payment',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                slipUrl: input.slipUrl ?? null,
                slipOkData: slip.slipData,
                amount: price.finalAmount,
                originalFee: price.baseFee,
                discount: price.discount,
                couponCode: price.couponLabel,
                couponId: price.couponId,
                hasNewPayment: !slip.verified,
            });
            return slip.verified;
        });

        return { ok: true, appointmentId: ref.id, isAutoApproved: verified, amount: price.finalAmount };
    } catch (e) {
        if (e instanceof AuthError) return { ok: false, error: e.message };
        if (e instanceof CouponRedeemError) return { ok: false, error: e.message };
        console.error('createAppointment failed:', e);
        return { ok: false, error: 'สร้างนัดหมายไม่สำเร็จ' };
    }
}
