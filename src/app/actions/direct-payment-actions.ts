'use server';

import * as admin from 'firebase-admin';
import { after } from 'next/server';
import { requireChatRole, AuthError } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { createContractFromChat } from '@/lib/contract-service';
import { getPendingAdditionalFee } from '@/lib/additional-fee';

/**
 * ลูกความจ่ายทนายโดยตรง — Lawslane ไม่รับ ไม่ถือ และไม่ตรวจเงินก้อนนี้
 *
 * โมเดลเดิม: ลูกความโอนเข้าบัญชีที่ hardcode ไว้ในหน้า /payment (บัญชีบุคคลของแพลตฟอร์ม)
 * แล้วแนบสลิปให้ SlipOK / แอดมินตรวจ → ระบบตั้งงวด/เคสเป็น 'paid' เอง
 * โมเดลใหม่ (ตัดสินใจ 2026-09-23 ดู LAWSLANE-PLAN-05):
 *   1. ลูกความเห็นบัญชีธนาคารของทนายเจ้าของเคส (อ่านจาก lawyerProfiles เฉพาะคู่กรณีของห้อง)
 *   2. โอนเอง แล้ว "แจ้งทนายว่าโอนแล้ว" พร้อมรูปหลักฐานหรือไม่ก็ได้ → notifyDirectPaymentAction
 *      **ไม่เปลี่ยนสถานะเงินใดๆ** แค่บันทึกคำแจ้ง (clientNotice / clientPaymentNotice)
 *   3. ทนายของเคส (หรือแอดมิน) เช็คบัญชีตัวเองแล้วกด "ได้รับเงินแล้ว"
 *      → confirmDirectPaymentReceivedAction เป็นทางเดียวที่ตั้งงวด/เคสเป็นจ่ายแล้ว
 *
 * ที่ต้องแยกสองขั้นแบบนี้: ถ้าให้คำแจ้งของลูกความเปลี่ยนสถานะเอง ก็กลับไปเป็นรูเดิม
 * (แนบรูปอะไรก็ได้แล้วงวดกลายเป็นจ่ายแล้ว) — คนเดียวที่รู้ว่าเงินเข้าจริงคือเจ้าของบัญชี
 */

export type DirectPaymentType = 'case' | 'installment' | 'additional';

export type DirectPaymentDue = {
    type: DirectPaymentType;
    amount: number;
    installmentIndex?: number;
    description: string;
    /** ลูกความแจ้งโอนรายการนี้ไว้แล้ว (ยังรอทนายยืนยัน) */
    notice: { notifiedAt: string; proofUrl: string | null; note: string | null } | null;
};

export type DirectPaymentInfo = {
    chatId: string;
    role: 'client' | 'lawyer' | 'admin';
    caseTitle: string;
    lawyer: {
        profileId: string;
        name: string;
        imageUrl: string;
        bankName: string;
        bankAccountNumber: string;
        bankAccountName: string;
    };
    hasBankAccount: boolean;
    due: DirectPaymentDue | null;
    /** รายการที่ยังค้างทั้งหมด (งวดที่ยังไม่ยืนยัน + ค่าบริการเพิ่มเติม + ค่าเปิดคดี) */
    outstanding: DirectPaymentDue[];
};

/** เหตุผลที่ตั้งใจให้ผู้ใช้เห็น (ไม่ export — ไฟล์ 'use server' export ได้แค่ async function) */
class DirectPaymentRejected extends Error {}

function parseAmount(v: unknown): number {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
}

function isoOrNull(v: any): string | null {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (typeof v?.toDate === 'function') return v.toDate().toISOString();
    if (v instanceof Date) return v.toISOString();
    return null;
}

/** ค่าเปิดคดีแบบจ่ายก้อนเดียว (เคสไม่มีงวด) ยืนยันแล้วหรือยัง — รองรับข้อมูลรุ่นเก่าที่ปิดผ่านสลิป/แอดมิน */
function isCaseFeeSettled(chat: FirebaseFirestore.DocumentData): boolean {
    if (chat.paymentConfirmedAt) return true;
    if (chat.paidAt) return true;
    const amount = parseAmount(chat.amount);
    const paid = parseAmount(chat.paidAmount);
    return amount > 0 && paid >= amount;
}

function listOutstanding(chat: FirebaseFirestore.DocumentData): DirectPaymentDue[] {
    const out: DirectPaymentDue[] = [];

    const additional = getPendingAdditionalFee(chat);
    if (additional) {
        const n = chat.clientPaymentNotice?.type === 'additional' ? chat.clientPaymentNotice : null;
        out.push({
            type: 'additional',
            amount: additional.amount,
            description: chat.pendingFeeRequest?.reason || chat.additionalFeeRequest?.reason || 'ค่าบริการเพิ่มเติม',
            notice: n ? { notifiedAt: isoOrNull(n.notifiedAt) || '', proofUrl: n.proofUrl ?? null, note: n.note ?? null } : null,
        });
    }

    const installments: any[] = Array.isArray(chat.installments) ? chat.installments : [];
    if (installments.length > 0) {
        installments.forEach((inst, i) => {
            if (inst?.status === 'paid') return;
            const n = inst?.clientNotice;
            out.push({
                type: 'installment',
                amount: parseAmount(inst?.amount),
                installmentIndex: i,
                description: `งวดที่ ${i + 1}${inst?.description ? `: ${inst.description}` : ''}`,
                notice: n ? { notifiedAt: n.notifiedAt || '', proofUrl: n.proofUrl ?? null, note: n.note ?? null } : null,
            });
        });
    } else if (parseAmount(chat.amount) > 0 && !isCaseFeeSettled(chat)) {
        const n = chat.clientPaymentNotice?.type === 'case' ? chat.clientPaymentNotice : null;
        out.push({
            type: 'case',
            amount: parseAmount(chat.amount),
            description: chat.caseTitle || 'ค่าบริการทนายความ',
            notice: n ? { notifiedAt: isoOrNull(n.notifiedAt) || '', proofUrl: n.proofUrl ?? null, note: n.note ?? null } : null,
        });
    }

    return out;
}

function pickDue(
    outstanding: DirectPaymentDue[],
    want?: { type?: DirectPaymentType; installmentIndex?: number }
): DirectPaymentDue | null {
    if (want?.type === 'installment' && Number.isInteger(want.installmentIndex)) {
        return outstanding.find(d => d.type === 'installment' && d.installmentIndex === want.installmentIndex) ?? null;
    }
    if (want?.type) {
        const hit = outstanding.find(d => d.type === want.type);
        if (hit) return hit;
    }
    return outstanding[0] ?? null;
}

async function loadLawyer(db: FirebaseFirestore.Firestore, chat: FirebaseFirestore.DocumentData) {
    const profileId: string = chat.lawyerId || chat.lawyer_id || '';
    const snap = profileId ? await db.collection('lawyerProfiles').doc(profileId).get() : null;
    const lp = snap?.exists ? snap.data()! : {};
    return {
        profileId,
        userId: (lp.userId as string) || '',
        email: (lp.email as string) || '',
        name: (lp.name as string) || 'ทนายความ',
        imageUrl: (lp.imageUrl as string) || '',
        bankName: (lp.bankName as string) || '',
        bankAccountNumber: (lp.bankAccountNumber as string) || '',
        bankAccountName: (lp.bankAccountName as string) || '',
    };
}

/**
 * ข้อมูลสำหรับหน้า "โอนให้ทนายโดยตรง" — ยอดที่ค้าง + บัญชีธนาคารของทนายเจ้าของเคส
 *
 * บัญชีธนาคารเป็นข้อมูลส่วนตัว (getLawyerProfileAction ซ่อนไว้จากหน้าสาธารณะ) จึงคืนให้เฉพาะ
 * คู่กรณีของห้องนี้ที่ผ่าน requireChatRole เท่านั้น ยอดทั้งหมดอ่านจากเอกสารห้อง ไม่รับจาก URL
 */
export async function getDirectPaymentInfoAction(
    chatId: string,
    want?: { type?: DirectPaymentType; installmentIndex?: number }
): Promise<{ ok: true; data: DirectPaymentInfo } | { ok: false; error: string }> {
    try {
        if (!chatId || typeof chatId !== 'string') return { ok: false, error: 'ไม่พบห้องสนทนา' };
        const { role, chatData, adminApp } = await requireChatRole(chatId);
        const db = adminApp.firestore();
        const lawyer = await loadLawyer(db, chatData);

        const outstanding = listOutstanding(chatData);
        const due = pickDue(outstanding, want);

        return {
            ok: true,
            data: {
                chatId,
                role,
                caseTitle: chatData.caseTitle || '',
                lawyer: {
                    profileId: lawyer.profileId,
                    name: lawyer.name,
                    imageUrl: lawyer.imageUrl,
                    bankName: lawyer.bankName,
                    bankAccountNumber: lawyer.bankAccountNumber,
                    bankAccountName: lawyer.bankAccountName,
                },
                hasBankAccount: !!(lawyer.bankName && lawyer.bankAccountNumber),
                due,
                outstanding,
            },
        };
    } catch (e) {
        if (e instanceof AuthError) return { ok: false, error: e.status === 404 ? 'ไม่พบห้องสนทนา' : 'ไม่มีสิทธิ์เข้าถึงรายการนี้' };
        console.error('getDirectPaymentInfoAction failed:', e);
        return { ok: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * ลูกความแจ้งทนายว่า "โอนให้แล้ว" (แนบรูปหลักฐานได้ ไม่บังคับ)
 *
 * ⚠️ ไม่เปลี่ยนสถานะเงินใดๆ ทั้งสิ้น — ไม่แตะ installments[].status / paidAmount / paidAt /
 * amount / status ของห้อง บันทึกแค่คำแจ้งไว้ให้ทนายเห็นแล้วไปเช็คบัญชีตัวเอง
 *
 * proofUrl ต้องเป็นรูปที่ผู้เรียกอัปเองผ่าน saveBase64SlipAction (`base64_slip_{id}`) เท่านั้น
 * — กันเอารูปของคนอื่น/ห้องอื่นมาอ้าง และกันยัด path ในบัคเก็ตให้ getSecureDownloadUrl
 * ยอมเปิดให้ (มันเชื่อ path ที่ถูกอ้างถึงในเอกสารห้อง)
 */
export async function notifyDirectPaymentAction(input: {
    chatId: string;
    type: DirectPaymentType;
    installmentIndex?: number;
    proofUrl?: string | null;
    note?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const { uid, role, adminApp } = await requireChatRole(input.chatId);
        if (role !== 'client') {
            return { ok: false, error: 'เฉพาะลูกความของเคสนี้เท่านั้นที่แจ้งโอนได้' };
        }
        if (!['case', 'installment', 'additional'].includes(input.type)) {
            return { ok: false, error: 'ประเภทรายการไม่ถูกต้อง' };
        }

        const limit = await checkRateLimit(`direct-payment-notice:${uid}`, 5, 10 * 60 * 1000);
        if (!limit.success) return { ok: false, error: 'แจ้งโอนถี่เกินไป กรุณารอสักครู่' };

        const db = adminApp.firestore();

        const proofUrl = typeof input.proofUrl === 'string' && input.proofUrl ? input.proofUrl : null;
        if (proofUrl) {
            const m = proofUrl.match(/^base64_slip_([A-Za-z0-9]+)$/);
            if (!m) return { ok: false, error: 'ไฟล์หลักฐานไม่ถูกต้อง' };
            const img = await db.collection('slipImages').doc(m[1]).get();
            if (!img.exists || img.data()?.uploadedBy !== uid) {
                return { ok: false, error: 'ไฟล์หลักฐานไม่ถูกต้อง' };
            }
        }
        const note = typeof input.note === 'string' ? input.note.trim().slice(0, 500) || null : null;

        const chatRef = db.collection('chats').doc(input.chatId);
        const nowIso = new Date().toISOString();

        const { amount, label, chatData } = await db.runTransaction(async (tx) => {
            const snap = await tx.get(chatRef);
            if (!snap.exists) throw new DirectPaymentRejected('ไม่พบห้องสนทนา');
            const chat = snap.data()!;
            const due = pickDue(listOutstanding(chat), { type: input.type, installmentIndex: input.installmentIndex });
            if (!due || due.type !== input.type || (input.type === 'installment' && due.installmentIndex !== input.installmentIndex)) {
                throw new DirectPaymentRejected('ไม่พบรายการที่ต้องชำระ หรือทนายยืนยันรับเงินไปแล้ว');
            }

            const update: Record<string, any> = {
                hasPaymentNotice: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            let label: string;
            if (due.type === 'installment') {
                const installments = [...chat.installments];
                const i = due.installmentIndex!;
                installments[i] = {
                    ...installments[i],
                    clientNotice: { notifiedAt: nowIso, proofUrl, note, notifiedBy: uid, amount: due.amount },
                };
                update.installments = installments;
                label = `งวดที่ ${i + 1}`;
            } else {
                update.clientPaymentNotice = {
                    type: due.type,
                    amount: due.amount,
                    proofUrl,
                    note,
                    notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                    notifiedBy: uid,
                };
                label = due.type === 'case' ? 'ค่าบริการ' : 'ค่าบริการเพิ่มเติม';
            }
            update.lastMessage = `📨 ลูกความแจ้งว่าโอน${label} ฿${due.amount.toLocaleString()} ให้ทนายแล้ว — รอทนายยืนยันรับเงิน`;
            tx.update(chatRef, update);
            return { amount: due.amount, label, chatData: chat };
        });

        const lawyer = await loadLawyer(db, chatData);
        const text = `📨 ลูกความแจ้งว่าโอน${label} ฿${amount.toLocaleString()} ให้ทนายโดยตรงแล้ว${proofUrl ? ' (แนบหลักฐานไว้)' : ''}${note ? `\nหมายเหตุ: ${note}` : ''}\nทนายกรุณาตรวจสอบบัญชีของท่าน แล้วกด "ยืนยันได้รับเงิน" ในเมนูจัดการเคส\n(Lawslane ไม่ได้รับหรือถือเงินก้อนนี้)`;
        await chatRef.collection('messages').add({
            chatId: input.chatId,
            text,
            senderId: 'system',
            senderName: 'ระบบแจ้งเตือน',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'payment_notice',
            metadata: { amount, paymentType: input.type, installmentIndex: input.installmentIndex ?? null, proofUrl },
        });

        if (lawyer.userId) {
            await db.collection('notifications').add({
                type: 'payment',
                title: 'ลูกความแจ้งโอนเงินให้คุณแล้ว',
                message: `${label} ฿${amount.toLocaleString()} — กรุณาตรวจสอบบัญชีของคุณแล้วยืนยันรับเงิน`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
                recipient: lawyer.userId,
                link: `/chat/${input.chatId}?view=lawyer`,
                relatedId: input.chatId,
            });
        }

        if (lawyer.email) {
            after(async () => {
                try {
                    const { NotificationService } = await import('@/services/notification-service');
                    await NotificationService.notifyLawyerClientPaymentNotice({
                        lawyerName: lawyer.name,
                        lawyerEmail: lawyer.email,
                        amount,
                        caseTitle: `${chatData.caseTitle || 'เคส'} — ${label}`,
                        chatId: input.chatId,
                        hasProof: !!proofUrl,
                    });
                } catch (err) {
                    console.error('notifyLawyerClientPaymentNotice failed:', err);
                }
            });
        }

        return { ok: true };
    } catch (e) {
        if (e instanceof AuthError) return { ok: false, error: e.status === 404 ? 'ไม่พบห้องสนทนา' : 'ไม่มีสิทธิ์ทำรายการนี้' };
        if (e instanceof DirectPaymentRejected) return { ok: false, error: e.message };
        console.error('notifyDirectPaymentAction failed:', e);
        return { ok: false, error: 'แจ้งโอนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * ทนายของเคส (หรือแอดมิน) ยืนยันว่า "ได้รับเงินแล้ว" — ทางเดียวที่ตั้งสถานะจ่ายแล้ว
 *
 * ใช้ได้ทั้งตอนลูกความแจ้งโอนมาแล้ว และตอนที่ทนายรับเงินช่องทางอื่น (เงินสด/โอนโดยไม่ได้แจ้ง)
 * ลูกความยืนยันแทนไม่ได้เด็ดขาด (requireChatRole ตัดสินบทบาทจากเอกสารห้อง ไม่รับจากผู้เรียก)
 */
export async function confirmDirectPaymentReceivedAction(input: {
    chatId: string;
    type: DirectPaymentType;
    installmentIndex?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const { uid, role, adminApp } = await requireChatRole(input.chatId);
        if (role !== 'lawyer' && role !== 'admin') {
            return { ok: false, error: 'เฉพาะทนายความของเคสนี้เท่านั้นที่ยืนยันรับเงินได้' };
        }
        const db = adminApp.firestore();
        const chatRef = db.collection('chats').doc(input.chatId);
        const nowIso = new Date().toISOString();

        const outcome = await db.runTransaction(async (tx) => {
            const snap = await tx.get(chatRef);
            if (!snap.exists) throw new DirectPaymentRejected('ไม่พบห้องสนทนา');
            const chat = snap.data()!;
            const update: Record<string, any> = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            const confirmation = { confirmedBy: uid, confirmedByRole: role };
            let amount = 0;
            let label = '';
            let firstPaid = false;

            if (input.type === 'installment') {
                const installments: any[] = Array.isArray(chat.installments) ? [...chat.installments] : [];
                const i = Number(input.installmentIndex);
                if (!Number.isInteger(i) || i < 0 || i >= installments.length) {
                    throw new DirectPaymentRejected('หมายเลขงวดไม่ถูกต้อง');
                }
                if (installments[i]?.status === 'paid') throw new DirectPaymentRejected('งวดนี้ยืนยันรับเงินไปแล้ว');

                const paidBefore = installments.filter(x => x?.status === 'paid').length;
                installments[i] = { ...installments[i], status: 'paid', paidAt: nowIso, ...confirmation };
                const paid = installments.filter(x => x?.status === 'paid');
                update.installments = installments;
                update.paidInstallments = paid.length;
                update.totalPaid = paid.reduce((s, x) => s + parseAmount(x?.amount), 0);
                amount = parseAmount(installments[i].amount);
                label = `งวดที่ ${i + 1}`;
                firstPaid = paidBefore === 0;
                if (firstPaid) update.paidAt = admin.firestore.FieldValue.serverTimestamp();
            } else if (input.type === 'case') {
                if (Array.isArray(chat.installments) && chat.installments.length > 0) {
                    throw new DirectPaymentRejected('เคสนี้แบ่งชำระเป็นงวด กรุณายืนยันทีละงวด');
                }
                amount = parseAmount(chat.amount);
                if (amount <= 0) throw new DirectPaymentRejected('เคสนี้ยังไม่มียอดค่าบริการ');
                if (isCaseFeeSettled(chat)) throw new DirectPaymentRejected('ยืนยันรับเงินรายการนี้ไปแล้ว');
                update.paidAmount = amount;
                update.paidAt = admin.firestore.FieldValue.serverTimestamp();
                update.paymentConfirmedAt = admin.firestore.FieldValue.serverTimestamp();
                update.paymentConfirmedBy = uid;
                update.paymentConfirmedByRole = role;
                if (chat.clientPaymentNotice?.type === 'case') update.clientPaymentNotice = admin.firestore.FieldValue.delete();
                label = 'ค่าบริการ';
                firstPaid = true;
            } else if (input.type === 'additional') {
                const additional = getPendingAdditionalFee(chat);
                if (!additional) throw new DirectPaymentRejected('ไม่พบคำขอค่าบริการเพิ่มเติมที่ค้างอยู่');
                amount = additional.amount;
                // ยอดรวมของเคสและยอดที่ได้รับแล้ว "สะสม" เพิ่ม ไม่เขียนทับ
                // (เคสรุ่นเก่าที่ไม่มี paidAmount แต่ขอค่าเพิ่มได้ = ค่าเปิดคดีจ่ายครบแล้ว)
                const baseAmount = parseAmount(chat.amount);
                const recordedPaid = parseAmount(chat.paidAmount);
                const basePaid = recordedPaid > 0 ? recordedPaid : (isCaseFeeSettled(chat) ? baseAmount : 0);
                update.amount = baseAmount + amount;
                update.paidAmount = basePaid + amount;
                if (additional.source === 'pendingFeeRequest') {
                    update.pendingFeeRequest = null;
                } else {
                    update['additionalFeeRequest.status'] = 'paid';
                    update['additionalFeeRequest.paidAt'] = admin.firestore.FieldValue.serverTimestamp();
                    update['additionalFeeRequest.confirmedBy'] = uid;
                }
                if (chat.clientPaymentNotice?.type === 'additional') update.clientPaymentNotice = admin.firestore.FieldValue.delete();
                label = 'ค่าบริการเพิ่มเติม';
            } else {
                throw new DirectPaymentRejected('ประเภทรายการไม่ถูกต้อง');
            }

            // ยังมีคำแจ้งโอนที่ค้างอยู่ไหม (หลังอัปเดตนี้)
            const nextInstallments: any[] = update.installments ?? chat.installments ?? [];
            const stillNotice =
                nextInstallments.some(x => x?.status !== 'paid' && x?.clientNotice) ||
                (update.clientPaymentNotice === undefined && !!chat.clientPaymentNotice);
            update.hasPaymentNotice = stillNotice;
            // ห้องเก่าที่ค้าง pending_payment จากโมเดลเดิม — ทนายยืนยันรับเงินแล้วก็เปิดใช้งานตามปกติ
            if (chat.status === 'pending_payment') update.status = 'active';
            update.lastMessage = `✅ ทนายยืนยันได้รับ${label} ฿${amount.toLocaleString()} แล้ว`;

            tx.update(chatRef, update);
            return { chat, amount, label, firstPaid };
        });

        const messagesRef = chatRef.collection('messages');
        if (outcome.firstPaid) {
            // สัญญาจ้างสร้างเมื่อได้รับเงินก้อนแรก (เหมือนโมเดลเดิม) — ล้มได้โดยไม่ย้อนการยืนยัน
            try {
                await createContractFromChat(db, {
                    chatId: input.chatId,
                    chatData: outcome.chat,
                    amount: outcome.amount,
                    messagesRef,
                });
            } catch (err) {
                console.error('createContractFromChat failed after confirm:', err);
            }
        }

        await messagesRef.add({
            chatId: input.chatId,
            text: `✅ ทนายความยืนยันว่าได้รับ${outcome.label} ฿${outcome.amount.toLocaleString()} เรียบร้อยแล้ว`,
            senderId: 'system',
            senderName: 'ระบบแจ้งเตือน',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'system_payment',
        });

        const clientId: string = outcome.chat.clientId || outcome.chat.userId || '';
        if (clientId) {
            await db.collection('notifications').add({
                type: 'payment',
                title: 'ทนายยืนยันได้รับเงินแล้ว',
                message: `${outcome.label} ฿${outcome.amount.toLocaleString()}`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
                recipient: clientId,
                link: `/chat/${input.chatId}`,
                relatedId: input.chatId,
            });
        }

        return { ok: true };
    } catch (e) {
        if (e instanceof AuthError) return { ok: false, error: e.status === 404 ? 'ไม่พบห้องสนทนา' : 'ไม่มีสิทธิ์ทำรายการนี้' };
        if (e instanceof DirectPaymentRejected) return { ok: false, error: e.message };
        console.error('confirmDirectPaymentReceivedAction failed:', e);
        return { ok: false, error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
    }
}
