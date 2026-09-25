'use server';

import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { createContractFromChat } from '@/lib/contract-service';
import { requireUser, requireChatRole, AuthError } from '@/lib/auth-guard';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { readSlipVerificationInTx } from '@/lib/slip-verification';
import { redeemCouponInTx, CouponRedeemError } from '@/lib/coupon-server';
import { getPendingAdditionalFee } from '@/lib/additional-fee';
import { resolvePaymentAmount } from '@/app/actions/payment-actions';

import { after } from 'next/server';

/** เหตุผลที่ตั้งใจให้ผู้ใช้เห็นเมื่อ transaction การชำระเงินถูกปฏิเสธ (ไม่ export — ไฟล์ 'use server') */
class PaymentRejected extends Error {}

/**
 * ผู้เรียกเป็นใครในห้องนี้ — ตัดสินจากเอกสารห้อง (clientId/userId และ
 * lawyerProfiles/{lawyerId}.userId) ไม่ใช่จาก participants
 *
 * เหตุที่ไม่เชื่อ participants: เดิม ensureChatExistsAction() เปิดโล่งและ
 * arrayUnion uid อะไรก็ได้ที่ผู้เรียกส่งมาเข้า participants → ใครก็ยัดตัวเองเข้าห้อง
 * คนอื่นแล้วอ่านแชท/ไฟล์ได้ (firestore.rules ใช้ participants ตัดสินสิทธิ์อ่าน)
 * participants จึงเป็นแค่ "ผลลัพธ์" ที่ server คำนวณให้ ห้ามใช้เป็นเกณฑ์
 *
 * ยกเว้นห้องรุ่นเก่าที่ไม่มีฟิลด์ลูกความเลย (role 'legacy') — ยอมตาม participants
 * เพื่อไม่ให้ห้องเก่าเปิดไม่ขึ้น แต่ห้ามใช้ role นี้เขียนอะไรที่ขยายสิทธิ์ (ซ่อม participants)
 */
type ChatParty = {
    role: 'client' | 'lawyer' | 'admin' | 'legacy';
    chatData: FirebaseFirestore.DocumentData;
    clientUid: string;
    lawyerUid: string;
    participants: string[];
};

async function resolveChatParty(
    db: FirebaseFirestore.Firestore,
    chatId: string,
    uid: string,
    isAdmin: boolean
): Promise<ChatParty> {
    const chatSnap = await db.collection('chats').doc(chatId).get();
    if (!chatSnap.exists) throw new AuthError('Chat not found.', 404);
    const chatData = chatSnap.data() || {};
    const participants: string[] = Array.isArray(chatData.participants) ? chatData.participants : [];

    const clientUid: string = chatData.clientId || chatData.userId || chatData.client_id || '';
    let lawyerUid: string = '';
    const lawyerProfileId: string = chatData.lawyerId || chatData.lawyer_id || '';
    if (lawyerProfileId) {
        const lp = await db.collection('lawyerProfiles').doc(lawyerProfileId).get();
        lawyerUid = lp.data()?.userId || '';
    }

    const base = { chatData, clientUid, lawyerUid, participants };
    if (isAdmin) return { role: 'admin', ...base };
    if (clientUid && clientUid === uid) return { role: 'client', ...base };
    if (lawyerUid && lawyerUid === uid) return { role: 'lawyer', ...base };
    if (!clientUid && participants.includes(uid)) return { role: 'legacy', ...base };
    throw new AuthError('Forbidden: not a party to this chat', 403);
}

/**
 * uid ที่ควรอยู่ใน participants — คำนวณจากเอกสารห้องเท่านั้น (ลูกความ + ทนายของห้อง)
 * lawyerId (id โปรไฟล์) ใส่ด้วยตามธรรมเนียมเดิมของ startConsultationAction
 * — โปรไฟล์ที่สมัครเองมี doc id = uid ของทนาย ส่วนที่แอดมินสร้างเป็น id สุ่มซึ่งไม่ใช่ uid ของใคร
 */
function legitParticipants(party: ChatParty): string[] {
    const out = new Set<string>();
    if (party.clientUid) out.add(party.clientUid);
    const lawyerProfileId = party.chatData.lawyerId || party.chatData.lawyer_id;
    if (lawyerProfileId) out.add(lawyerProfileId);
    if (party.lawyerUid) out.add(party.lawyerUid);
    return [...out];
}

/** เติม participants ที่ขาด — เฉพาะ uid ที่มาจาก legitParticipants() ไม่เคยรับจากผู้เรียก */
async function repairParticipants(db: FirebaseFirestore.Firestore, chatId: string, party: ChatParty) {
    if (party.role === 'legacy') return false;
    const missing = legitParticipants(party).filter(p => !party.participants.includes(p));
    if (missing.length === 0) return false;
    await db.collection('chats').doc(chatId).update({
        participants: admin.firestore.FieldValue.arrayUnion(...missing)
    });
    return true;
}

export async function getChatDetailsAction(chatId: string) {
    try {
        // ตัวตนจาก session เสมอ (requireUser ตรวจ revoke ด้วย)
        let uid: string, token: DecodedIdToken, adminApp;
        try {
            ({ uid, token, adminApp } = await requireUser());
        } catch (e) {
            if (e instanceof AuthError) return { success: false, error: 'Unauthorized: No session found.' };
            throw e;
        }
        const db = adminApp.firestore();
        const isAdminCaller = token.admin === true || token.role === 'admin';

        let party: ChatParty;
        try {
            party = await resolveChatParty(db, chatId, uid, isAdminCaller);
        } catch (e) {
            if (e instanceof AuthError && e.status === 404) return { success: false, error: 'Chat not found.' };
            if (e instanceof AuthError) {
                console.warn(`[Security] Unauthorized access attempt to chat ${chatId} by user ${uid}`);
                // หน้าแชทเทียบข้อความนี้ตรงๆ เพื่อแสดง "ไม่มีสิทธิ์เข้าถึง"
                return { success: false, error: 'Unauthorized access.' };
            }
            throw e;
        }

        const data = party.chatData;
        const isRequesterAdmin = party.role === 'admin';

        // REPAIR: เดิมใส่ requesterId และค่าจากห้องลง participants โดยตรวจสิทธิ์จาก
        // participants เอง (ซึ่งโดนยัดมาได้) — ตอนนี้เติมได้แค่ลูกความ/ทนายของห้องจริงเท่านั้น
        if (await repairParticipants(db, chatId, party)) {
            console.log(`[getChatDetailsAction] Repairing participants for chat ${chatId}`);
        }

        const lawyerId = data.lawyerId;
        const participants = party.participants;
        const clientId = party.clientUid || participants.find(p => p !== lawyerId);
        
        let clientName = data.clientName || 'ลูกความ';
        
        if (clientId && (clientName === 'ลูกความ' || !clientName)) {
            try {
                // 1. Try Firestore users collection first
                const userDoc = await db.collection('users').doc(clientId).get();
                if (userDoc.exists && userDoc.data()?.name && userDoc.data()?.name !== 'ลูกความ') {
                    clientName = userDoc.data()?.name;
                } else {
                    // 2. Fallback to Firebase Auth (Admin SDK)
                    const userRecord = await adminApp.auth().getUser(clientId);
                    if (userRecord.displayName) {
                        clientName = userRecord.displayName;
                        // Auto-repair the Firestore doc if it exists but has a generic name
                        if (userDoc.exists) {
                            await db.collection('users').doc(clientId).update({ name: clientName });
                        } else {
                            await db.collection('users').doc(clientId).set({
                                uid: clientId,
                                name: clientName,
                                email: userRecord.email,
                                role: 'customer',
                                status: 'active',
                                createdAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                        }
                    }
                }
            } catch (err) {
                console.warn(`[getChatDetailsAction] Auth lookup failed for ${clientId}:`, err);
            }
        }

        // uid จริงของทนาย (ใช้กับ E2EE และ dashboard) — resolveChatParty อ่านมาแล้ว
        const lawyerUserId = data.lawyerUserId || party.lawyerUid || null;

        return {
            success: true,
            isRequesterAdmin,
            data: JSON.parse(JSON.stringify({
                id: chatId,
                ...data,
                clientName, // Return the recovered name
                lawyerUserId, // Return the real UID
                createdAt: data?.createdAt?.toDate?.(),
                lastMessageAt: data?.lastMessageAt?.toDate?.()
            }))
        };
    } catch (error: any) {
        console.error("Error fetching chat details action:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * ซ่อม participants ของห้องที่มีอยู่แล้ว (หน้าแชทเรียกตอนโหลด)
 *
 * เดิม action นี้ไม่มีด่านเลย: ห้องยังไม่มี → สร้างห้อง `status: 'active'` ด้วย
 * participants ที่ผู้เรียกส่งมา (= ได้เคส active ฟรีโดยไม่ผ่านการชำระเงิน) และห้องมีแล้ว →
 * arrayUnion uid อะไรก็ได้เข้าไป (= ยัดตัวเองเข้าห้องคนอื่นแล้วอ่านแชท/ไฟล์ได้)
 *
 * ตอนนี้: ผู้เรียกต้องเป็นคู่กรณีของห้องอยู่แล้ว · ไม่สร้างห้องใหม่อีก (การสร้างห้อง
 * ทำฝั่ง server เท่านั้น: createConsultationChat / respondToAppointmentRequestAction /
 * startConsultationAction / createManualCaseAction) · เติมได้แค่ uid ลูกความและทนาย
 * ที่อ่านจากเอกสารห้อง — พารามิเตอร์ participants/caseTitle คงไว้เพื่อไม่ให้ผู้เรียกเดิมพัง แต่ไม่ใช้แล้ว
 */
export async function ensureChatExistsAction(chatId: string, _participants?: string[], _caseTitle?: string) {
    try {
        const { uid, token, adminApp } = await requireUser();
        const db = adminApp.firestore();
        const party = await resolveChatParty(db, chatId, uid, token.admin === true || token.role === 'admin');
        await repairParticipants(db, chatId, party);
        return { success: true };
    } catch (error: any) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error("Error ensuring chat exists action:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

export async function sendChatMessageAction(params: {
    chatId: string,
    text: string,
    senderId: string,
    senderName: string,
    recipientId: string,
    isLawyerView: boolean,
    authToken?: string,
    skipMessageSave?: boolean,
    metadata?: any
}) {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const db = adminApp.firestore();

        const { chatId, text, senderId, authToken, skipMessageSave, metadata } = params;
        const senderName = String(params.senderName || '').slice(0, 100);

        // 0. Auth — ตัวตนต้องยืนยันได้เสมอ
        // เดิมถ้าไม่ส่ง authToken มา จะเชื่อ senderId ที่ส่งมาแล้วเช็คแค่ว่าอยู่ใน participants
        // → ส่งข้อความในนามคนอื่นได้ และถ้าส่ง token มา ก็ไม่เช็คเลยว่าเป็นคนในห้อง
        // → ใครที่ล็อกอินก็โพสต์ลงห้องไหนก็ได้ พร้อมยิงแจ้งเตือน/อีเมลไปหา recipientId ที่ตั้งเอง
        let callerUid: string;
        let callerIsAdmin = false;
        if (authToken) {
            try {
                const decodedToken = await adminApp.auth().verifyIdToken(authToken, true);
                callerUid = decodedToken.uid;
                callerIsAdmin = decodedToken.admin === true || decodedToken.role === 'admin';
            } catch (authErr: any) {
                console.error('[Auth] Token verification failed:', authErr.message);
                return { success: false, error: 'Unauthorized: invalid auth token.' };
            }
        } else {
            const session = await requireUser();
            callerUid = session.uid;
            callerIsAdmin = session.token.admin === true || session.token.role === 'admin';
        }
        if (callerUid !== senderId) {
            console.error(`[Auth] Token UID mismatch: token=${callerUid}, senderId=${senderId}`);
            return { success: false, error: 'Unauthorized: sender identity mismatch.' };
        }

        let party: ChatParty;
        try {
            party = await resolveChatParty(db, chatId, callerUid, callerIsAdmin);
        } catch (e) {
            if (e instanceof AuthError && e.status === 404) return { success: false, error: 'Chat not found.' };
            if (e instanceof AuthError) {
                console.error(`[Auth] senderId ${senderId} is not a party of chat ${chatId}`);
                return { success: false, error: 'Unauthorized: not a participant of this chat.' };
            }
            throw e;
        }

        // AUTO-REPAIR: ทนายของห้องที่ยังไม่อยู่ใน participants (เติมเฉพาะ uid ที่ได้จากเอกสารห้อง)
        await repairParticipants(db, chatId, party);

        // ฝั่งผู้ส่งและผู้รับมาจากบทบาทจริงในห้อง ไม่ใช่จากค่าที่ส่งมา
        // (แอดมิน/ห้องรุ่นเก่าไม่รู้ฝั่งแน่ชัด จึงใช้ค่าที่ส่งมา แต่ผู้รับต้องเป็นคนในห้องเท่านั้น)
        const isLawyerView = party.role === 'lawyer' ? true
            : party.role === 'client' ? false
            : params.isLawyerView === true;
        let recipientId: string;
        if (party.role === 'lawyer') {
            recipientId = party.clientUid;
        } else if (party.role === 'client') {
            recipientId = party.lawyerUid;
        } else {
            const allowed = new Set([party.clientUid, party.lawyerUid, ...party.participants].filter(Boolean));
            recipientId = allowed.has(params.recipientId) && params.recipientId !== callerUid ? params.recipientId : '';
        }

        // 1. Rate Limiting Protection (10 messages per 5 seconds)
        const rateCheck = await checkRateLimit(senderId, 10, 5000);
        if (!rateCheck.success) {
            return { success: false, error: 'ส่งข้อความบ่อยเกินไป กรุณารอสักครู่ (Rate limit exceeded)' };
        }

        const batch = db.batch();

        // 2. Add message to subcollection if not skipped
        if (!skipMessageSave) {
            const messageRef = db.collection('chats').doc(chatId).collection('messages').doc();
            batch.set(messageRef, {
                text,
                senderId,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                metadata: metadata || null
            });
        }

        // 3. Update parent chat metadata
        //    FIX: When sender writes, clear the RECIPIENT's ReadAt field so UI won't show stale "Read" status.
        const chatRef = db.collection('chats').doc(chatId);
        batch.update(chatRef, {
            lastMessage: text,
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            hasNewMessage: !isLawyerView,
            ...(isLawyerView
                ? {
                    lawyerReadAt: admin.firestore.FieldValue.serverTimestamp(),
                    lawyerReadStatus: 'read',
                    // Clear client's read status so UI shows "unread" for the new message
                    clientReadAt: admin.firestore.FieldValue.delete(),
                    clientReadStatus: 'unread',
                  }
                : {
                    clientReadAt: admin.firestore.FieldValue.serverTimestamp(),
                    clientReadStatus: 'read',
                    // Clear lawyer's read status so UI shows "unread" for the new message
                    lawyerReadAt: admin.firestore.FieldValue.delete(),
                    lawyerReadStatus: 'unread',
                  }
            )
        });

        // 4. Create In-App Notification
        // Link logic: If lawyer sends -> Client clicks (goes to client view). If client sends -> Lawyer clicks (goes to lawyer view).
        let notificationLink = `/chat/${chatId}`;
        if (isLawyerView) {
             // Notification for client
             notificationLink = `/chat/${chatId}`; 
        } else {
             // Notification for lawyer
             notificationLink = `/chat/${chatId}?view=lawyer`;
        }

        // ไม่รู้ผู้รับที่แน่ชัด (เช่นห้องที่ยังไม่มีทนาย) = ไม่สร้างแจ้งเตือน ดีกว่าส่งผิดคน
        if (recipientId) batch.set(db.collection('notifications').doc(), {
            type: metadata?.type === 'file_upload' ? 'file_upload' : 'chat_message',
            title: metadata?.type === 'file_upload' ? `เอกสารใหม่จาก ${senderName}` : `ข้อความใหม่จาก ${senderName}`,
            message: text.length > 50 ? text.substring(0, 50) + '...' : text,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
            recipient: recipientId,
            link: notificationLink,
            relatedId: chatId,
            metadata: metadata || null
        });

        await batch.commit();

        // 5. Trigger Real-time Notification (Email/Push)
        // Background process: we want to start this but not let it block the core success if it's slow
        if (recipientId) try {
            const now = Date.now();
            const ACTIVE_THRESHOLD_MS = 120 * 1000; // Increased to 2 minutes for better UX

            if (!isLawyerView) {
                // Client sending to Lawyer
                // 1. Try lawyerProfiles by document ID first
                let lawyerDoc = await db.collection('lawyerProfiles').doc(recipientId).get();
                let lawyerEmail = '';
                let lawyerName = '';
                let lawyerLineId = '';
                
                if (lawyerDoc.exists) {
                    const data = lawyerDoc.data() || {};
                    lawyerEmail = data.email;
                    lawyerName = data.name || 'ทนายความ';
                    lawyerLineId = data.lineId || '';
                } else {
                    // Try to find by userId
                    const lpQuery = await db.collection('lawyerProfiles').where('userId', '==', recipientId).limit(1).get();
                    if (!lpQuery.empty) {
                        const data = lpQuery.docs[0].data();
                        lawyerEmail = data.email;
                        lawyerName = data.name || 'ทนายความ';
                        lawyerLineId = data.lineId || '';
                    }
                }
                
                // 2. Fallback to users collection if email is missing (sometimes profile is incomplete)
                if (!lawyerEmail || !lawyerLineId) {
                    const userDoc = await db.collection('users').doc(recipientId).get();
                    if (userDoc.exists) {
                        const data = userDoc.data() || {};
                        if (!lawyerEmail) lawyerEmail = data.email;
                        if (!lawyerLineId) lawyerLineId = data.lineId || '';
                        if (!lawyerName || lawyerName === 'ทนายความ') lawyerName = data.name || 'ทนายความ';
                    }
                }

                if (lawyerEmail || lawyerLineId) {
                    const chatDoc = await db.collection('chats').doc(chatId).get();
                    const chatData = chatDoc.data();
                    
                    // Presence check: check both LastSeenAt and lawyerReadAt
                    const lawyerSeenAt = chatData?.lawyerLastSeenAt?.toDate()?.getTime() || 0;
                    const lawyerReadAt = chatData?.lawyerReadAt?.toDate()?.getTime() || 0;
                    const lastActive = Math.max(lawyerSeenAt, lawyerReadAt);
                    
                    const isActive = (now - lastActive) < ACTIVE_THRESHOLD_MS;
                    
                    // Only notify if they haven't been active recently
                    if (!isActive) {
                        const { NotificationService } = await import('@/services/notification-service');
                        await NotificationService.notifyLawyerNewChat({
                            lawyerId: recipientId,
                            lawyerName: lawyerName,
                            lawyerEmail: lawyerEmail,
                            lawyerLineId: lawyerLineId,
                            clientName: senderName,
                            messageSnippet: text.substring(0, 100),
                            chatId
                        });
                    }
                } else {
                    console.warn(`[Notification] Skipping email to lawyer ${recipientId}: No email found in profiles or users.`);
                }
            } else {
                // Lawyer sending to Client
                let clientEmail = '';
                let clientName = '';
                
                const clientDoc = await db.collection('users').doc(recipientId).get();
                if (clientDoc.exists) {
                    const clientData = clientDoc.data() || {};
                    clientEmail = clientData.email;
                    clientName = clientData.name || 'ลูกความ';
                }
                
                if (clientEmail) {
                    const chatDoc = await db.collection('chats').doc(chatId).get();
                    const chatData = chatDoc.data();
                    
                    const clientSeenAt = chatData?.clientLastSeenAt?.toDate()?.getTime() || 0;
                    const clientReadAt = chatData?.clientReadAt?.toDate()?.getTime() || 0;
                    const lastActive = Math.max(clientSeenAt, clientReadAt);
                    
                    const isActive = (now - lastActive) < ACTIVE_THRESHOLD_MS;
                    if (!isActive) {
                        const { NotificationService } = await import('@/services/notification-service');
                        await NotificationService.notifyClientNewChat({
                            clientId: recipientId,
                            clientName: clientName,
                            clientEmail: clientEmail,
                            lawyerName: senderName,
                            messageSnippet: text.substring(0, 100),
                            chatId
                        });
                    }
                }
            }
        } catch (notifyErr) {
            console.error("Non-blocking notification error:", notifyErr);
        }

        return { success: true };
    } catch (error: any) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error("Error sending chat message action:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Marks a chat as read by both lawyer or client.
 */
export async function markChatAsReadAction(chatId: string, isLawyerViewHint: boolean = true) {
    try {
        // เดิมไม่มีด่านเลย — ใครก็ยิงเปลี่ยนสถานะอ่าน/presence ของห้องไหนก็ได้
        // (presence ใช้ตัดสินว่าจะส่งอีเมลแจ้งเตือนหรือไม่ = ปิดอีเมลแจ้งเตือนของห้องคนอื่นได้)
        const { uid, token, adminApp } = await requireUser();
        const db = adminApp.firestore();
        const party = await resolveChatParty(db, chatId, uid, token.admin === true || token.role === 'admin');

        // ฝั่งมาจากบทบาทจริง — ลูกความตั้ง lawyerReadAt แทนทนายไม่ได้
        const isLawyerView = party.role === 'lawyer' ? true
            : party.role === 'client' ? false
            : isLawyerViewHint === true;

        const updateData: any = {};
        if (isLawyerView) {
            updateData.lawyerReadAt = admin.firestore.FieldValue.serverTimestamp();
            updateData.lawyerLastSeenAt = admin.firestore.FieldValue.serverTimestamp(); // Track presence
            updateData.lawyerReadStatus = 'read';
            updateData.hasNewMessage = false;
        } else {
            updateData.clientReadAt = admin.firestore.FieldValue.serverTimestamp();
            updateData.clientLastSeenAt = admin.firestore.FieldValue.serverTimestamp(); // Track presence
            updateData.clientReadStatus = 'read';
        }

        await db.collection('chats').doc(chatId).update(updateData);

        // Also mark all in-app notifications for this chat as read
        try {
            const notificationsSnap = await db.collection('notifications')
                .where('recipient', '==', uid)
                .where('relatedId', '==', chatId)
                .where('read', '==', false)
                .get();

            if (!notificationsSnap.empty) {
                const batch = db.batch();
                notificationsSnap.docs.forEach(doc => {
                    batch.update(doc.ref, { read: true });
                });
                await batch.commit();
            }
        } catch (notifErr) {
            console.warn("[markChatAsReadAction] Failed to clear notifications:", notifErr);
        }
        return { success: true };
    } catch (error: any) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error("Error marking chat as read action:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Handles a lawyer's request for a case opening fee.
 */
export async function requestFeeAction(params: {
    chatId: string;
    lawyerId: string;
    lawyerName: string;
    amount: number;
    reason: string;
}) {
    try {
        // เดิมไม่มีด่านตรวจสิทธิ์ — และ pendingFeeRequest.amount คือยอดที่
        // resolvePaymentAmount('additional') ใช้เรียกเก็บ ลูกความจึงยิงตั้งคำขอ
        // ฿1 ให้ห้องตัวเองแล้วจ่าย ฿1 ได้ ต้องเป็นทนายของห้องนี้ (หรือแอดมิน) เท่านั้น
        const { role } = await requireChatRole(params.chatId);
        if (role === 'client') {
            return { success: false, error: 'เฉพาะทนายความของเคสนี้เท่านั้นที่แจ้งค่าบริการได้' };
        }
        const requested = Number(params.amount);
        if (!Number.isFinite(requested) || requested <= 0 || Math.round(requested * 100) / 100 !== requested) {
            return { success: false, error: 'จำนวนเงินไม่ถูกต้อง' };
        }

        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const db = adminApp.firestore();

        const { chatId, lawyerId, lawyerName, amount, reason } = params;

        const chatRef = db.collection('chats').doc(chatId);
        const chatSnap = await chatRef.get();
        if (!chatSnap.exists) return { success: false, error: 'Chat not found' };

        const chatData = chatSnap.data();
        const clientId = chatData?.participants?.find((p: string) => p !== lawyerId) || chatData?.userId || chatData?.clientId;

        if (!clientId) return { success: false, error: 'Client not found for this chat' };

        // 1. Update Firestore
        await chatRef.update({
            pendingFeeRequest: {
                amount,
                reason,
                requestedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            lastMessage: `[PROPOSAL] ทนายขอเสนอนัดหมาย/เปิดเคส: ฿${amount.toLocaleString()}`,
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 2. Add System Message to Chat
        const messagesRef = chatRef.collection('messages');
        const newMessageRef = messagesRef.doc();
        await newMessageRef.set({
            chatId: chatId,
            text: `📋 **แจ้งชำระค่าบริการ:** ฿${amount.toLocaleString()}\nรายละเอียด: ${reason}\nกรุณาตรวจสอบและชำระเงิน`,
            senderId: lawyerId,
            senderName: lawyerName,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'case_proposal',
            metadata: {
                caseTitle: reason,
                amount: amount,
                isManualCase: false 
            }
        });

        // 3. Create In-App Notification
        const notificationRef = db.collection('notifications').doc();
        await notificationRef.set({
            type: 'payment',
            title: `แจ้งชำระค่าบริการ`,
            message: `ทนายความแจ้งชำระค่าบริการ จำนวน ฿${amount.toLocaleString()} - ${reason}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
            recipient: clientId,
            link: `/payment?chatId=${chatId}&type=consultation`,
            relatedId: chatId
        });

        // 4. Trigger Email Notification
        try {
            const clientDoc = await db.collection('users').doc(clientId).get();
            if (clientDoc.exists) {
                const clientData = clientDoc.data();
                if (clientData?.email) {
                    const { NotificationService } = await import('@/services/notification-service');
                    await NotificationService.notifyClientFeeRequested({
                        clientName: clientData.name || 'ลูกความ',
                        clientEmail: clientData.email,
                        lawyerName,
                        amount,
                        reason,
                        chatId
                    });
                }
            }
        } catch (notifyErr) {
            console.error("Async client fee notification error:", notifyErr);
        }

        return { success: true };
    } catch (error: any) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error("Error in requestFeeAction:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * อีเมลแจ้งทนาย / ลูกความ / แอดมิน หลังบันทึกการชำระเงินแล้ว
 *
 * เดิมเป็น action ที่เปิดโล่ง (notifyPaymentCompletedAction) ให้หน้า payment เรียกเอง
 * พร้อม amount / isAutoApproved / lawyerId / payerName จากเบราว์เซอร์ → ใครก็ยิงอีเมล
 * "ได้รับชำระเงินแล้ว ฿xxx (ตรวจสลิปแล้ว)" ในนาม Lawslane ไปหาทนายคนไหนก็ได้ (ทนาย
 * อาจเริ่มงานทั้งที่ยังไม่มีเงินเข้า) และยิงซ้ำให้กล่องแอดมินท่วมได้
 * ตอนนี้ไม่ export แล้ว — markInstallmentPaidAction / markCasePaidAction เรียกเองหลัง
 * transaction สำเร็จ ด้วยยอดและผลตรวจสลิปของ server และทนายอ่านจากเอกสารห้อง
 */
async function sendPaymentCompletedEmails(db: FirebaseFirestore.Firestore, params: {
    chatId: string;
    chatData: FirebaseFirestore.DocumentData;
    amount: number;
    caseTitle: string;
    payerName: string;
    isAutoApproved: boolean;
}) {
    try {
        const { chatId, chatData, amount, caseTitle, payerName, isAutoApproved } = params;
        const lawyerId: string = chatData.lawyerId || chatData.lawyer_id || '';

        // Fetch lawyer info
        const lawyerDoc = lawyerId ? await db.collection('lawyerProfiles').doc(lawyerId).get() : null;
        const lawyerData = lawyerDoc?.exists ? lawyerDoc.data() : null;
        const lawyerEmail = lawyerData?.email;
        const lawyerName = lawyerData?.name || 'ทนายความ';

        // Fetch client info from chat
        const clientId = chatData?.clientId || chatData?.userId;
        let clientEmail = '';
        let clientName = payerName;

        if (clientId) {
            const clientDoc = await db.collection('users').doc(clientId).get();
            if (clientDoc.exists) {
                const cd = clientDoc.data();
                clientEmail = cd?.email || '';
                clientName = cd?.name || payerName;
            }
        }

        const { NotificationService } = await import('@/services/notification-service');

        // Notify lawyer
        if (lawyerEmail) {
            console.log(`[sendPaymentCompletedEmails] Sending email to lawyer: ${lawyerEmail}`);
            await NotificationService.notifyPaymentReceived({
                lawyerName,
                lawyerEmail,
                clientName,
                amount,
                caseTitle: caseTitle || chatData?.caseTitle || 'เคส',
                chatId,
                isAutoApproved,
            });
        } else {
            console.warn(`[sendPaymentCompletedEmails] No lawyer email found for lawyerId: ${lawyerId}`);
        }

        // Confirm to client
        if (clientEmail) {
            console.log(`[sendPaymentCompletedEmails] Sending email to client: ${clientEmail}`);
            await NotificationService.notifyClientPaymentConfirmation({
                clientName,
                clientEmail,
                lawyerName,
                amount,
                caseTitle: caseTitle || chatData?.caseTitle || 'เคส',
                chatId,
                isAutoApproved,
            });
        }

        console.log(`[sendPaymentCompletedEmails] Sending email to admins`);
        await NotificationService.notifyAdminPaymentReceived({
            lawyerName,
            clientName,
            amount,
            caseTitle: caseTitle || chatData?.caseTitle || 'เคส',
            chatId,
            isAutoApproved,
        });
    } catch (error: any) {
        // อีเมลล้มต้องไม่ทำให้การชำระเงินที่บันทึกแล้วดูเหมือนล้ม
        console.error("Error in sendPaymentCompletedEmails:", error);
    }
}


/**
 * Atomically marks a single installment as paid within a chat document.
 * - Updates the installment's status, paidAt, and slipUrl
 * - Recalculates paidInstallments count and totalPaid sum
 * - Sets the chat status to 'active' if this is the first installment paid
 */
export async function markInstallmentPaidAction(params: {
    chatId: string;
    installmentIndex: number;
    slipUrl: string;
    slipVerificationId?: string | null;
    couponCode?: string;
    payerName?: string;
}) {
    try {
        // เดิม action นี้ไม่มีด่านตรวจสิทธิ์เลย และรับ `amount` กับ `slipOkData`
        // มาจากผู้เรียกตรงๆ → ใครก็ยิงเข้ามาพร้อม amount เท่าไรก็ได้ แล้วปิดงวด
        // ของเคสคนอื่นเป็น 'paid' ได้ทั้งที่ไม่เคยจ่าย
        const { uid, role } = await requireChatRole(params.chatId);
        if (role === 'lawyer') {
            return { success: false, error: 'ทนายความไม่สามารถแจ้งชำระเงินแทนลูกความได้' };
        }

        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const db = adminApp.firestore();

        // ยอดต้องมาจาก server — อ่านจากเอกสารงวดใน Firestore ไม่ใช่จาก argument
        const price = await resolvePaymentAmount({
            paymentType: 'installment',
            chatId: params.chatId,
            installmentIndex: params.installmentIndex,
            couponCode: params.couponCode,
        });
        if (!price.ok) return { success: false, error: price.error };
        const amount = price.finalAmount;

        const chatRef = db.collection('chats').doc(params.chatId);

        // อ่านงวด + ใช้ตั๋วสลิป + ตัดคูปอง + เขียนงวด ในก้อนเดียว
        // เดิมใช้ตั๋วสลิปก่อนแล้วค่อยเขียนงวดทีหลัง (เขียนล้ม = เสียสลิปฟรี) และ
        // คูปองตัดทีหลังแบบ log ทิ้งถ้าไม่สำเร็จ (ยิงพร้อมกันได้ส่วนลดเกิน usageLimit)
        const outcome = await db.runTransaction(async (tx) => {
            const chatSnap = await tx.get(chatRef);
            if (!chatSnap.exists) throw new PaymentRejected('ไม่พบห้องแชทนี้ในระบบ');

            const chatData = chatSnap.data()!;
            const installments = chatData.installments || [];

            // Validate index
            if (params.installmentIndex < 0 || params.installmentIndex >= installments.length) {
                throw new PaymentRejected('หมายเลขงวดไม่ถูกต้อง');
            }

            const targetInstallment = installments[params.installmentIndex];

            // Check if already paid
            if (targetInstallment.status === 'paid') {
                throw new PaymentRejected('งวดนี้ได้รับการชำระเงินแล้ว');
            }
            // ยอดงวดเปลี่ยนระหว่างคิดราคากับยืนยัน — ห้ามปิดงวดด้วยยอดเก่า
            if ((Number(targetInstallment.amount) || 0) !== price.baseFee) {
                throw new PaymentRejected('ยอดงวดนี้เปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่');
            }

            // Enforce sequential payment: all previous installments must be paid
            for (let i = 0; i < params.installmentIndex; i++) {
                if (installments[i].status !== 'paid') {
                    throw new PaymentRejected(`กรุณาชำระงวดที่ ${i + 1} ก่อน`);
                }
            }

            // สลิปที่ผ่าน SlipOK จริงเท่านั้น — ตัวเดียวที่ตั้ง 'paid' ได้เองโดยไม่ผ่านแอดมิน
            const slip = await readSlipVerificationInTx(tx, db, uid, params.slipVerificationId, amount);
            if (price.couponId) await redeemCouponInTx(tx, db, price.couponId);
            slip.commit();

            const isAutoApproved = slip.verified;
            const slipData = slip.slipData;

            // Update the specific installment
            installments[params.installmentIndex] = {
                ...targetInstallment,
                status: isAutoApproved ? 'paid' : 'pending_verification',
                paidAt: isAutoApproved ? new Date().toISOString() : null,
                submittedAt: new Date().toISOString(),
                slipUrl: params.slipUrl,
                slipOkData: slipData,
            };

            // Recalculate totals (only those actually paid)
            const paidInstallments = installments.filter((inst: any) => inst.status === 'paid').length;
            const totalPaid = installments
                .filter((inst: any) => inst.status === 'paid')
                .reduce((sum: number, inst: any) => {
                    const amt = parseFloat(String(inst.amount).replace(/,/g, ''));
                    return sum + (isNaN(amt) ? 0 : amt);
                }, 0);

            const isFirstPayment = paidInstallments === 1;
            const allPaid = paidInstallments === installments.length;

            // Build the update payload
            const updatePayload: any = {
                installments,
                paidInstallments,
                totalPaid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                // ไม่ผ่าน = ต้องให้แอดมินตรวจ
                hasNewPayment: !isAutoApproved,
                // Store per-installment payment details for admin audit
                [`pendingPaymentDetails_installment_${params.installmentIndex}`]: {
                    amount,
                    slipUrl: params.slipUrl,
                    slipOkData: slipData,
                    type: 'installment',
                    installmentIndex: params.installmentIndex,
                    submittedAt: new Date().toISOString(),
                    payerName: params.payerName || 'ลูกความ',
                },
            };

            if (!isAutoApproved) {
                updatePayload.lastMessage = `⏳ ลูกความแจ้งชำระเงินงวดที่ ${params.installmentIndex + 1} (฿${amount.toLocaleString()}) รอตรวจสอบสลิป`;
            } else if (allPaid) {
                updatePayload.lastMessage = `🎉 ลูกความชำระเงินครบทุกงวดแล้ว (฿${totalPaid.toLocaleString()})`;
            } else {
                updatePayload.lastMessage = `✅ ลูกความชำระเงินงวดที่ ${params.installmentIndex + 1} เรียบร้อยแล้ว (฿${amount.toLocaleString()})`;
            }

            // First installment paid → activate the case
            if (isFirstPayment) {
                updatePayload.status = 'active';
                updatePayload.paidAt = admin.firestore.FieldValue.serverTimestamp();
            }

            tx.update(chatRef, updatePayload);

            return {
                chatData,
                isAutoApproved,
                paidInstallments,
                totalPaid,
                allPaid,
                isFirstPayment,
                lastMessage: updatePayload.lastMessage as string,
            };
        });

        const messagesRef = chatRef.collection('messages');

        // CONTRACT CREATION: first installment paid → create Capdeal contract + system message
        // อยู่นอก transaction เพราะ createContractFromChat อ่าน/เขียนหลายคอลเลกชันเอง
        // และล้มได้โดยไม่ควรทำให้การชำระเงินที่บันทึกแล้วย้อนกลับ
        if (outcome.isFirstPayment) {
            try {
                await createContractFromChat(db, {
                    chatId: params.chatId,
                    chatData: outcome.chatData,
                    amount,
                    messagesRef,
                });
            } catch (contractErr) {
                console.error("Failed to create contract:", contractErr);
            }
        }

        // Also post a system message to the chat messages collection
        await messagesRef.doc().set({
            chatId: params.chatId,
            text: outcome.lastMessage,
            senderId: 'system',
            senderName: 'ระบบแจ้งเตือน',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'system_payment'
        });

        // อีเมลแจ้งเตือนส่งหลังตอบกลับแล้ว (after) ด้วยยอด/ผลตรวจของ server
        after(() => sendPaymentCompletedEmails(db, {
            chatId: params.chatId,
            chatData: outcome.chatData,
            amount,
            caseTitle: `งวดที่ ${params.installmentIndex + 1}`,
            payerName: params.payerName || 'ลูกความ',
            isAutoApproved: outcome.isAutoApproved,
        }));

        return {
            success: true,
            paidInstallments: outcome.paidInstallments,
            totalPaid: outcome.totalPaid,
            allPaid: outcome.allPaid,
            isFirstPayment: outcome.isFirstPayment,
            isAutoApproved: outcome.isAutoApproved,
            amount,
        };
    } catch (error: any) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        if (error instanceof PaymentRejected) return { success: false, error: error.message };
        if (error instanceof CouponRedeemError) return { success: false, error: error.message };
        console.error("Error in markInstallmentPaidAction:", error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกการชำระเงิน กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Removes a file from the chat's files array.
 */
export async function deleteFileAction(chatId: string, fileUrl: string) {
    try {
        // เดิมไม่มีด่านเลย — ใครก็ลบไฟล์ (หลักฐาน/เอกสารคดี) ออกจากห้องของคนอื่นได้
        // ตอนนี้: ต้องเป็นคู่กรณีของห้อง และลบได้เฉพาะไฟล์ที่ตัวเองอัป
        // (ทนายของห้องและแอดมินลบได้ทุกไฟล์ในห้อง)
        const { uid, token, adminApp } = await requireUser();
        const db = adminApp.firestore();
        const party = await resolveChatParty(db, chatId, uid, token.admin === true || token.role === 'admin');

        const chatRef = db.collection('chats').doc(chatId);
        const files = party.chatData.files || [];
        const fileToRemove = files.find((f: any) => f.url === fileUrl);

        if (fileToRemove) {
            const canDelete = party.role === 'admin' || party.role === 'lawyer' || fileToRemove.uploadedBy === uid;
            if (!canDelete) {
                return { success: false, error: 'ลบได้เฉพาะไฟล์ที่คุณอัปโหลดเอง' };
            }
            await chatRef.update({
                files: admin.firestore.FieldValue.arrayRemove(fileToRemove),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        return { success: true };
    } catch (error: any) {
        if (error instanceof AuthError) return { success: false, error: error.status === 404 ? 'ไม่พบห้องแชท' : error.message };
        console.error("Error in deleteFileAction:", error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการลบไฟล์' };
    }
}

// sendEmailAction (ส่งอีเมล "ทดสอบ" ไปที่อยู่ใดก็ได้ หัวข้อใดก็ได้ ไม่มีด่านตรวจสิทธิ์
// = open relay ในนามโดเมนเรา) ถูกลบออกแล้ว — ไม่มีโค้ดส่วนไหนเรียกใช้

/**
 * Marks a full case or additional fee as paid
 */
export async function markCasePaidAction(params: {
    chatId: string;
    slipUrl: string;
    slipVerificationId?: string | null;
    couponCode?: string;
    payerName: string;
    type: 'case' | 'additional';
}) {
    try {
        // เดิม action นี้ไม่มีด่านตรวจสิทธิ์ และรับ `amount`/`slipOkData` จากผู้เรียก
        // → ยิงเข้ามาพร้อม slipOkData ปลอมแล้วเปลี่ยนเคสของคนอื่นเป็น 'active' ได้เลย
        const { uid, role } = await requireChatRole(params.chatId);
        if (role === 'lawyer') {
            return { success: false, error: 'ทนายความไม่สามารถแจ้งชำระเงินแทนลูกความได้' };
        }

        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const db = adminApp.firestore();

        // ยอดต้องมาจากเอกสารใน Firestore ไม่ใช่จาก argument
        // ('additional' = ยอดของคำขอค่าบริการเพิ่มเติมที่ค้างอยู่ ดู lib/additional-fee.ts)
        const price = await resolvePaymentAmount({
            paymentType: params.type,
            chatId: params.chatId,
            couponCode: params.couponCode,
        });
        if (!price.ok) return { success: false, error: price.error };
        const amount = price.finalAmount;

        const chatRef = db.collection('chats').doc(params.chatId);

        // อ่านห้อง + ใช้ตั๋วสลิป + ตัดคูปอง + เขียนสถานะ ในก้อนเดียว (เหตุผลเดียวกับ
        // markInstallmentPaidAction)
        const { chatData, isAutoApproved, lastMessage } = await db.runTransaction(async (tx) => {
            const chatSnap = await tx.get(chatRef);
            if (!chatSnap.exists) throw new PaymentRejected('ไม่พบห้องแชทนี้ในระบบ');
            const chatData = chatSnap.data()!;

            // คำขอค่าบริการเพิ่มเติมต้องยังค้างอยู่และยอดเท่าเดิมตอนยืนยัน
            const additional = params.type === 'additional' ? getPendingAdditionalFee(chatData) : null;
            if (params.type === 'additional' && (!additional || additional.amount !== price.baseFee)) {
                throw new PaymentRejected('คำขอชำระค่าบริการเพิ่มเติมเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่');
            }
            // ส่งซ้ำระหว่างรอตรวจจะเขียนทับสลิปใบแรกจนหายจากคิวหลังบ้าน และตัดคูปองซ้ำ
            // (แอดมินกดปฏิเสธแล้วส่งใหม่ได้ เพราะขั้นปฏิเสธล้าง hasNewPayment)
            if (additional && chatData.hasNewPayment === true && chatData.pendingPaymentDetails?.type === 'additional') {
                throw new PaymentRejected('มีรายการแจ้งชำระค่าบริการเพิ่มเติมรอตรวจอยู่แล้ว');
            }

            // สลิปที่ผ่าน SlipOK จริงเท่านั้นที่ข้ามด่านแอดมินได้
            const slip = await readSlipVerificationInTx(tx, db, uid, params.slipVerificationId, amount);
            if (price.couponId) await redeemCouponInTx(tx, db, price.couponId);
            slip.commit();

            const isAutoApproved = slip.verified;
            const slipData = slip.slipData;

            const updatePayload: any = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                status: isAutoApproved ? 'active' : (chatData.status === 'active' ? 'active' : 'pending_payment'),
                paidAt: isAutoApproved ? admin.firestore.FieldValue.serverTimestamp() : (chatData.paidAt || null),
                paidAmount: isAutoApproved ? amount : (chatData.paidAmount || 0),
                hasNewPayment: !isAutoApproved,
            };

            // ค่าบริการเพิ่มเติมที่สลิปผ่านจริง: ยอดรวมของเคสและยอดที่จ่ายแล้ว "สะสม"
            // เพิ่ม ไม่ใช่เขียนทับ — ต้องคิดแบบเดียวกับ approvePaymentSlipAction ของ
            // lawslane-admin ไม่งั้นเคสเดียวกันได้ยอดต่างกันตามทางที่อนุมัติ
            // (paidAmount ใช้คิดยอดคืนเงินตอนยกเลิกเคส; เคสเก่าที่ไม่มี paidAmount
            // ถือว่าจ่ายครบตาม amount เดิมแล้ว เพราะเคสต้อง active ถึงขอค่าเพิ่มได้)
            if (additional && isAutoApproved) {
                const baseAmount = Number(chatData.amount) || 0;
                // paidAmount ≤ 0 ถือว่าไม่มีข้อมูลเหมือนกัน — หน้าแจ้งโอนรุ่นเก่าเขียน 0 ไว้ตอนรอตรวจ
                // และการอนุมัติมือรุ่นเก่าไม่เคยตั้งค่าให้ ทั้งที่เคส active = จ่ายค่าเปิดเคสแล้ว
                const recordedPaid = Number(chatData.paidAmount) || 0;
                const basePaid = recordedPaid > 0 ? recordedPaid : baseAmount;
                updatePayload.amount = baseAmount + amount;
                updatePayload.paidAmount = basePaid + amount;
                // สถานะเหมือนฝั่งแอดมิน: ยืนยันเงินเข้าแล้ว = active
                updatePayload.status = 'active';
                // สลิปรอบก่อนที่ยังรอตรวจ (เช่นอ่าน QR ไม่ได้) ต้องล้างทิ้ง ไม่งั้นรอบหน้าที่
                // hasNewPayment กลับเป็น true หลังบ้านจะตีความเป็นค่าบริการเพิ่มเติมแล้วบวกยอดซ้ำ
                updatePayload.pendingPaymentDetails = admin.firestore.FieldValue.delete();
            } else if (additional) {
                // ยังไม่ผ่าน = รอแอดมิน ห้ามแตะ paidAmount/paidAt — ถ้าเขียน 0 ลงเคสเก่า
                // ที่ไม่มี paidAmount ฝั่งแอดมินจะเอา 0 เป็นฐานแทน amount
                delete updatePayload.paidAmount;
                delete updatePayload.paidAt;
            }

            if (params.type === 'case') {
                // Mark all installments as paid if it's a full case payment
                const installments = chatData.installments || [];
                const updatedInstallments = installments.map((inst: any) => ({
                    ...inst,
                    status: isAutoApproved ? 'paid' : (inst.status || 'pending'),
                    paidAt: (isAutoApproved && !inst.paidAt) ? new Date().toISOString() : (inst.paidAt || null),
                    slipUrl: (isAutoApproved && !inst.slipUrl) ? params.slipUrl : (inst.slipUrl || null),
                }));
                updatePayload.installments = updatedInstallments;
                updatePayload.paidInstallments = updatedInstallments.filter((i: any) => i.status === 'paid').length;
                updatePayload.totalPaid = updatedInstallments
                    .filter((i: any) => i.status === 'paid')
                    .reduce((sum: number, i: any) => {
                        const amt = parseFloat(String(i.amount).replace(/,/g, ''));
                        return sum + (isNaN(amt) ? 0 : amt);
                    }, 0);
            }

            // สลิปผ่านจริงแล้วเท่านั้นถึงปิดคำขอของทนาย — ไม่งั้นคำขอค้างให้จ่ายซ้ำได้
            // (ยังไม่ผ่าน = คงคำขอไว้ให้ขั้นอนุมัติสลิปฝั่งแอดมินเป็นคนปิด)
            if (additional && isAutoApproved) {
                if (additional.source === 'pendingFeeRequest') {
                    updatePayload.pendingFeeRequest = null;
                } else {
                    updatePayload['additionalFeeRequest.status'] = 'paid';
                    updatePayload['additionalFeeRequest.paidAt'] = admin.firestore.FieldValue.serverTimestamp();
                }
            }

            if (!isAutoApproved) {
                updatePayload.pendingPaymentDetails = {
                    amount,
                    slipUrl: params.slipUrl,
                    slipOkData: slipData,
                    type: params.type,
                    submittedAt: new Date().toISOString(),
                    payerName: params.payerName,
                };
                updatePayload.lastMessage = `⏳ ลูกความแจ้งชำระเงิน${params.type === 'case' ? 'ค่าเปิดคดี' : 'ค่าบริการเพิ่มเติม'} (฿${amount.toLocaleString()}) รอตรวจสอบสลิป`;
            } else {
                updatePayload.lastMessage = `✅ ลูกความชำระเงิน${params.type === 'case' ? 'ค่าเปิดคดี' : 'ค่าบริการเพิ่มเติม'} เรียบร้อยแล้ว (฿${amount.toLocaleString()})`;
            }

            tx.update(chatRef, updatePayload);
            return { chatData, isAutoApproved, lastMessage: updatePayload.lastMessage as string };
        });

        // Post system message
        const messagesRef = chatRef.collection('messages');
        await messagesRef.add({
            chatId: params.chatId,
            text: lastMessage,
            senderId: 'system',
            senderName: 'ระบบแจ้งเตือน',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'system_payment'
        });

        // CONTRACT CREATION: Create contract for full case payment (no installments)
        // Fires for both auto-approved and pending-verification so lawyer & client
        // always see the contract regardless of slip scan outcome.
        if (params.type === 'case') {
            try {
                await createContractFromChat(db, {
                    chatId: params.chatId,
                    chatData,
                    amount,
                    messagesRef,
                });
            } catch (contractErr) {
                console.error("Failed to create contract in markCasePaidAction:", contractErr);
            }
        }

        after(() => sendPaymentCompletedEmails(db, {
            chatId: params.chatId,
            chatData,
            amount,
            caseTitle: params.type === 'case' ? 'ค่าเปิดคดี' : 'ค่าบริการเพิ่มเติม',
            payerName: params.payerName || 'ลูกความ',
            isAutoApproved,
        }));

        return { success: true, isAutoApproved, amount };
    } catch (error: any) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        if (error instanceof PaymentRejected) return { success: false, error: error.message };
        if (error instanceof CouponRedeemError) return { success: false, error: error.message };
        console.error("Error in markCasePaidAction:", error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกการชำระเงิน กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Lawyer or Admin approves a pending installment payment
 */
export async function approveInstallmentAction(chatId: string, installmentIndex: number) {
    try {
        // เดิมไม่มีด่านตรวจสิทธิ์ — ลูกความแนบสลิปอะไรก็ได้ (pending_verification)
        // แล้วยิง action นี้อนุมัติงวดของตัวเองเป็น 'paid' เปิดเคสเป็น 'active' ได้
        // โดยไม่มีใครตรวจว่าเงินเข้าจริง ต้องเป็นทนายของเคสหรือแอดมินเท่านั้น
        const { role } = await requireChatRole(chatId);
        if (role === 'client') {
            return { success: false, error: 'ลูกความไม่สามารถอนุมัติการชำระเงินของตัวเองได้' };
        }

        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const db = adminApp.firestore();

        const chatRef = db.collection('chats').doc(chatId);
        const chatDoc = await chatRef.get();
        if (!chatDoc.exists) return { success: false, error: 'Chat not found' };
        
        const chatData = chatDoc.data()!;
        const installments = chatData.installments || [];
        
        if (installmentIndex < 0 || installmentIndex >= installments.length) {
            return { success: false, error: 'Invalid installment index' };
        }

        const inst = installments[installmentIndex];
        if (inst.status !== 'pending_verification') {
            return { success: false, error: 'Payment is not pending verification' };
        }

        // Update status to paid
        installments[installmentIndex].status = 'paid';
        installments[installmentIndex].paidAt = new Date().toISOString();

        const paidCount = installments.filter((i: any) => i.status === 'paid').length;
        const totalPaid = installments
            .filter((i: any) => i.status === 'paid')
            .reduce((sum: number, i: any) => {
                const amt = parseFloat(String(i.amount).replace(/,/g, ''));
                return sum + (isNaN(amt) ? 0 : amt);
            }, 0);

        const updatePayload: any = {
            installments,
            paidInstallments: paidCount,
            totalPaid,
            hasNewPayment: installments.some((i: any) => i.status === 'pending_verification'),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMessage: `✅ การชำระเงินงวดที่ ${installmentIndex + 1} ได้รับการอนุมัติแล้ว`,
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // If it's the first installment, activate the case and create contract
        if (paidCount === 1) {
            updatePayload.status = 'active';
            updatePayload.paidAt = admin.firestore.FieldValue.serverTimestamp();
            
            // Create Contract (viewable within Lawslane)
            try {
                await createContractFromChat(db, {
                    chatId,
                    chatData,
                    amount: inst.amount,
                    messagesRef: chatRef.collection('messages'),
                });
            } catch (e) {
                console.error("Contract creation failed during approval:", e);
            }
        }

        await chatRef.update(updatePayload);

        // System message for payment approval
        await chatRef.collection('messages').add({
            chatId,
            text: updatePayload.lastMessage,
            senderId: 'system',
            senderName: 'ระบบแจ้งเตือน',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'system_payment'
        });

        return { success: true };
    } catch (error: any) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error("Error approving installment:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Robustly starts a new consultation chat from the server side.
 * Ensures chat creation, initial message, in-app notification, and email are all handled.
 */
export async function startConsultationAction(params: {
    lawyerId: string;
    /** @deprecated ไม่ใช้แล้ว — ลูกความคือผู้เรียก (อ่านจาก session) */
    clientId?: string;
    clientName: string;
    initialMessage: string;
    locale: string;
}) {
    const { lawyerId, clientName, initialMessage, locale } = params;

    try {
        // ตัวตนลูกความมาจาก session เท่านั้น — เดิมไม่มีด่านตรวจสิทธิ์เลยและเชื่อ
        // clientId ที่ส่งมา → ใครก็เปิดห้องแชทในนามคนอื่นได้ (ผู้ใช้คนนั้นกลายเป็น
        // participant ของห้องที่ตัวเองไม่ได้เปิด พร้อมข้อความที่คนอื่นพิมพ์ในนามเขา)
        const { uid: clientId, adminApp } = await requireUser();
        const db = adminApp.firestore();

        // 1. Resolve Lawyer Auth UID — ทนายต้องมีโปรไฟล์จริง
        // เดิมโปรไฟล์ไม่มีก็ fallback ใช้ lawyerId ที่ส่งมาเป็น uid ใส่ participants ตรงๆ
        const lpSnap = await db.collection('lawyerProfiles').doc(lawyerId).get();
        const lpData = lpSnap.exists ? lpSnap.data() : null;
        if (!lpData?.userId) return { success: false, error: 'ไม่พบทนายความปลายทาง' };
        const lawyerAuthId: string = lpData.userId;
        if (lawyerAuthId === clientId) return { success: false, error: 'ไม่สามารถเปิดห้องสนทนากับตัวเองได้' };
        const lawyerEmail = lpData.email || '';
        const lawyerLineId = lpData.lineId || '';
        const lawyerName = lpData.name || 'ทนายความ';

        const chatId = db.collection('chats').doc().id;
        const participants = Array.from(new Set([clientId, lawyerId, lawyerAuthId]));

        const chatPayload = {
            participants,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            caseTitle: `Ticket สนทนา: ${initialMessage.substring(0, 30)}${initialMessage.length > 30 ? '...' : ''}`,
            status: 'active',
            lawyerId: lawyerId,
            userId: clientId,
            clientId: clientId,
            lastMessage: initialMessage,
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            amount: 0,
            originalFee: 0,
            discount: 0,
            hasNewMessage: true,
            lawyerReadStatus: 'unread',
            clientReadStatus: 'read'
        };

        const batch = db.batch();
        const chatRef = db.collection('chats').doc(chatId);
        
        // Create Chat
        batch.set(chatRef, chatPayload);

        // Create Initial Message
        const msgRef = chatRef.collection('messages').doc();
        batch.set(msgRef, {
            text: initialMessage,
            senderId: clientId,
            senderName: clientName,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // Create In-App Notification for Lawyer
        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
            type: 'chat_message',
            title: `คำขอปรึกษาใหม่จากคุณ ${clientName}`,
            message: initialMessage.length > 100 ? initialMessage.substring(0, 100) + '...' : initialMessage,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
            recipient: lawyerAuthId,
            link: `/${locale}/chat/${chatId}?view=lawyer`,
            relatedId: chatId
        });

        await batch.commit();

        // Send Email Notification via Server
        if (lawyerEmail) {
            try {
                const { sendLawyerNewCaseEmail } = await import('@/lib/lawyer-new-case-email');
                // Use absolute URL for the link
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lawslane.com';
                const caseLink = `${baseUrl}/${locale}/chat/${chatId}?lawyerId=${lawyerId}&clientId=${clientId}&view=lawyer`;
                
                await sendLawyerNewCaseEmail(
                    lawyerEmail,
                    lawyerName,
                    clientName,
                    initialMessage,
                    caseLink
                );
            } catch (emailErr) {
                console.error("[startConsultationAction] Email failed:", emailErr);
            }
        }

        return { success: true, chatId };
    } catch (error: any) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error("Error in startConsultationAction:", error);
        return { success: false, error: error.message };
    }
}
