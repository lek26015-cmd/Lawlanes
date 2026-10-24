'use server';

import * as admin from 'firebase-admin';
import { requireChatRole, requireUser, authErrorResult } from '@/lib/auth-guard';
import {
    sanitizeClientInput, sanitizeLawyerInput,
    type PoaClientInput, type PoaLawyerInput, type PoaStatus, type PoaView,
} from '@/lib/power-of-attorney';

/**
 * หนังสือมอบอำนาจ / ใบแต่งทนายความของห้องคดี (PLAN-11)
 * `powersOfAttorney/{id}` ไม่มี rules ฝั่ง client — อ่าน/เขียนผ่านไฟล์นี้เท่านั้น เพราะมีเลขบัตรประชาชนลูกความ
 * ห้องหนึ่งมีฉบับที่ใช้งานได้ (ไม่ถูกยกเลิก) ได้ฉบับเดียว
 */

type Db = FirebaseFirestore.Firestore;
type Doc = FirebaseFirestore.DocumentData;

const COLLECTION = 'powersOfAttorney';

const millis = (v: any): number => (v?.toMillis ? v.toMillis() : typeof v === 'number' ? v : 0);

function toView(id: string, d: Doc): PoaView {
    return {
        id,
        chatId: d.chatId,
        status: d.status as PoaStatus,
        caseTitle: d.caseTitle || '',
        input: d.input as PoaLawyerInput,
        lawyer: { name: d.lawyer?.name || '', licenseNumber: d.lawyer?.licenseNumber || '', phone: d.lawyer?.phone || '' },
        client: (d.client as PoaClientInput) || null,
        clientConfirmedAt: millis(d.clientConfirmedAt) || null,
        createdAt: millis(d.createdAt),
        updatedAt: millis(d.updatedAt),
    };
}

async function findActive(db: Db, chatId: string) {
    const snap = await db.collection(COLLECTION).where('chatId', '==', chatId).get();
    return snap.docs
        .filter(d => d.get('status') !== 'cancelled')
        .sort((a, b) => millis(b.get('createdAt')) - millis(a.get('createdAt')))[0] || null;
}

const clientUidOf = (chat: Doc): string => chat.clientId || chat.userId || chat.client_id || '';

async function postSystemMessage(db: Db, chatId: string, text: string, metadata: Record<string, unknown>) {
    await db.collection('chats').doc(chatId).collection('messages').add({
        chatId,
        text,
        senderId: 'system',
        senderName: 'ระบบแจ้งเตือน',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        type: 'power_of_attorney',
        metadata,
    });
}

async function notify(db: Db, recipient: string, title: string, message: string, link: string, relatedId: string) {
    if (!recipient) return;
    await db.collection('notifications').add({
        type: 'document',
        title,
        message,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
        recipient,
        link,
        relatedId,
    });
}

/** ฉบับปัจจุบันของห้อง + ค่าเริ่มต้นจากโปรไฟล์ทนาย (ไว้เติมฟอร์มครั้งแรก) */
export async function getChatPowerOfAttorneyAction(chatId: string) {
    try {
        const { role, chatData, adminApp } = await requireChatRole(chatId);
        const db = adminApp.firestore();
        const active = await findActive(db, chatId);
        let lawyerDefaults: { address: string; name: string; licenseNumber: string } | null = null;
        if (role === 'lawyer' && !active && chatData.lawyerId) {
            const p = (await db.collection('lawyerProfiles').doc(chatData.lawyerId).get()).data() || {};
            lawyerDefaults = { address: p.address || '', name: p.name || '', licenseNumber: p.licenseNumber || '' };
        }
        return {
            success: true as const,
            role,
            poa: active ? toView(active.id, active.data()) : null,
            lawyerDefaults,
        };
    } catch (e) {
        return authErrorResult(e);
    }
}

/** ทนายสร้าง/แก้ร่าง — แก้หลังลูกความยืนยันแล้วต้องให้ลูกความยืนยันใหม่ */
export async function saveLawyerPowerOfAttorneyAction(chatId: string, raw: unknown) {
    try {
        const { role, uid, chatData, adminApp } = await requireChatRole(chatId);
        if (role !== 'lawyer') return { success: false as const, error: 'เฉพาะทนายของคดีนี้เท่านั้น' };
        const parsed = sanitizeLawyerInput(raw);
        if (!parsed.ok) return { success: false as const, error: parsed.error };

        const db = adminApp.firestore();
        const profile = (await db.collection('lawyerProfiles').doc(chatData.lawyerId).get()).data() || {};
        // ชื่อ/เลขใบอนุญาตมาจากโปรไฟล์เสมอ — ไม่รับจากฟอร์ม (ห้ามแต่งเลขใบอนุญาต)
        const lawyer = { name: profile.name || '', licenseNumber: profile.licenseNumber || '', phone: profile.phone || '' };
        const now = admin.firestore.FieldValue.serverTimestamp();
        const active = await findActive(db, chatId);
        const clientUid = clientUidOf(chatData);

        let id: string;
        let wasReady = false;
        if (active) {
            id = active.id;
            wasReady = active.get('status') === 'ready';
            // อำนาจพิเศษที่ลูกความเคยให้ ตัดข้อที่ทนายไม่ได้ขอแล้วออก
            const prevClient = active.get('client') as PoaClientInput | null;
            await active.ref.update({
                input: parsed.value,
                lawyer,
                status: 'awaiting_client',
                clientConfirmedAt: null,
                ...(prevClient ? { client: { ...prevClient, grantedPowers: prevClient.grantedPowers.filter(p => parsed.value.court.requestedPowers.includes(p)) } } : {}),
                updatedAt: now,
            });
        } else {
            const ref = db.collection(COLLECTION).doc();
            id = ref.id;
            await ref.set({
                chatId,
                lawyerUid: uid,
                lawyerProfileId: chatData.lawyerId,
                clientUid,
                caseTitle: chatData.caseTitle || '',
                status: 'awaiting_client',
                input: parsed.value,
                lawyer,
                client: null,
                clientConfirmedAt: null,
                createdAt: now,
                updatedAt: now,
            });
        }

        const names = [parsed.value.poa && 'หนังสือมอบอำนาจ', parsed.value.courtAppointment && 'ใบแต่งทนายความ'].filter(Boolean).join(' และ ');
        const text = active
            ? `📝 ทนายแก้ไข${names}${wasReady ? ' — ลูกความกรุณาตรวจและยืนยันอีกครั้ง' : ''}`
            : `📝 ทนายส่ง${names}ให้ลูกความ\nลูกความกรุณากรอกข้อมูลของท่านและยืนยันที่การ์ด "หนังสือมอบอำนาจ" ในรายละเอียดคดี`;
        await postSystemMessage(db, chatId, text, { poaId: id });
        await notify(db, clientUid, `ทนายส่ง${names}ให้คุณ`, 'กรุณากรอกข้อมูลและยืนยันในห้องคดี', `/chat/${chatId}`, chatId);

        return { success: true as const, id };
    } catch (e) {
        return authErrorResult(e);
    }
}

/** ลูกความกรอกข้อมูลตัวเอง + เลือกอำนาจพิเศษ แล้วยืนยัน */
export async function submitClientPowerOfAttorneyAction(chatId: string, raw: unknown) {
    try {
        const { role, chatData, adminApp } = await requireChatRole(chatId);
        if (role !== 'client') return { success: false as const, error: 'เฉพาะลูกความของคดีนี้เท่านั้น' };
        const db = adminApp.firestore();
        const active = await findActive(db, chatId);
        if (!active) return { success: false as const, error: 'ยังไม่มีหนังสือมอบอำนาจในคดีนี้' };

        const input = active.get('input') as PoaLawyerInput;
        const parsed = sanitizeClientInput(raw, input.court.requestedPowers);
        if (!parsed.ok) return { success: false as const, error: parsed.error };

        await active.ref.update({
            client: parsed.value,
            status: 'ready',
            clientConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await postSystemMessage(db, chatId, '✅ ลูกความกรอกข้อมูลและยืนยันหนังสือมอบอำนาจแล้ว — พิมพ์เอกสารเพื่อลงลายมือชื่อได้', { poaId: active.id });
        const lawyerUid = active.get('lawyerUid') || '';
        await notify(db, lawyerUid, 'ลูกความยืนยันหนังสือมอบอำนาจแล้ว', chatData.caseTitle || 'พร้อมพิมพ์เพื่อลงลายมือชื่อ', `/chat/${chatId}?view=lawyer`, chatId);

        return { success: true as const };
    } catch (e) {
        return authErrorResult(e);
    }
}

export async function cancelPowerOfAttorneyAction(chatId: string) {
    try {
        const { role, adminApp } = await requireChatRole(chatId);
        if (role !== 'lawyer') return { success: false as const, error: 'เฉพาะทนายของคดีนี้เท่านั้น' };
        const db = adminApp.firestore();
        const active = await findActive(db, chatId);
        if (!active) return { success: true as const };
        await active.ref.update({ status: 'cancelled', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        await postSystemMessage(db, chatId, '🗑️ ทนายยกเลิกหนังสือมอบอำนาจฉบับนี้แล้ว', { poaId: active.id });
        return { success: true as const };
    } catch (e) {
        return authErrorResult(e);
    }
}

/** หน้าพิมพ์ — เฉพาะทนาย/ลูกความของห้องนั้น (หรือแอดมิน) */
export async function getPowerOfAttorneyForPrintAction(id: string) {
    try {
        const { uid, token, adminApp } = await requireUser();
        const snap = await adminApp.firestore().collection(COLLECTION).doc(id).get();
        if (!snap.exists) return { success: false as const, error: 'ไม่พบเอกสาร' };
        const d = snap.data()!;
        const isAdmin = token.admin === true || token.role === 'admin';
        if (!isAdmin && uid !== d.lawyerUid && uid !== d.clientUid) {
            return { success: false as const, error: 'ไม่มีสิทธิ์เข้าถึงเอกสารนี้' };
        }
        return { success: true as const, poa: toView(snap.id, d) };
    } catch (e) {
        return authErrorResult(e);
    }
}
