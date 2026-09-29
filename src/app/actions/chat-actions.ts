'use server';

import { initAdmin } from '@/lib/firebase-admin';
import { addCaseEventToBatch, isTelemetryEnabled, logCaseEvent } from '@/lib/telemetry/case-events';
import * as admin from 'firebase-admin';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { requireUser, requireChatRole, AuthError } from '@/lib/auth-guard';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { confirmDirectPaymentReceivedAction } from '@/app/actions/direct-payment-actions';

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

        // เอกสารเคสที่ resolveChatParty อ่านมาแล้ว — ใช้ต่อกับ telemetry ชั้น A
        // จึงไม่ต้องอ่านซ้ำ (ไม่เพิ่ม read ต่อข้อความ)
        const chatData = party.chatData;

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

        // --- Telemetry ชั้น A: counters บนเอกสารเคสเดิม (ดู src/lib/telemetry/case-events.ts) ---
        // นับข้อความสองฝั่ง + เวลาตอบกลับครั้งแรก เพื่อคำนวณ responsiveness และ
        // silent-drop ได้ โดยไม่แตะเนื้อข้อความเลย (แชทเป็น E2EE — server เห็นแต่ ciphertext)
        const telemetryOn = await isTelemetryEnabled(db);
        const lawyerProfileId: string = chatData.lawyerId || chatData.lawyer_id || '';
        const firstClientMsgAt = chatData.firstClientMsgAt;
        const isFirstClientMsg = !isLawyerView && !firstClientMsgAt;
        const isFirstLawyerReply = isLawyerView && !!firstClientMsgAt && !chatData.firstLawyerReplyAt;
        const firstReplyLatencyMs = isFirstLawyerReply
            ? Math.max(0, Date.now() - (firstClientMsgAt?.toMillis?.() ?? Date.now()))
            : 0;

        const telemetryFields: Record<string, any> = telemetryOn
            ? {
                [isLawyerView ? 'msgCountLawyer' : 'msgCountClient']:
                    admin.firestore.FieldValue.increment(1),
                ...(isFirstClientMsg
                    ? { firstClientMsgAt: admin.firestore.FieldValue.serverTimestamp() }
                    : {}),
                ...(isFirstLawyerReply
                    ? {
                        firstLawyerReplyAt: admin.firestore.FieldValue.serverTimestamp(),
                        firstReplyLatencyMs,
                      }
                    : {}),
              }
            : {};

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
            ...telemetryFields,
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

        // 4.5 Telemetry ชั้น B — เฉพาะเหตุการณ์สำคัญ ไม่ log ทุกข้อความ
        //     เกาะไปกับ batch เดิม จึงไม่เพิ่ม round-trip
        if (telemetryOn && lawyerProfileId) {
            if (isFirstClientMsg) {
                addCaseEventToBatch(db, batch, {
                    caseId: chatId,
                    lawyerId: lawyerProfileId,
                    type: 'first_client_message',
                    actor: 'client',
                });
            }
            if (isFirstLawyerReply) {
                addCaseEventToBatch(db, batch, {
                    caseId: chatId,
                    lawyerId: lawyerProfileId,
                    type: 'first_lawyer_reply',
                    actor: 'lawyer',
                    n: Math.round(firstReplyLatencyMs / 60000), // นาที
                });
            }
        }

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
        // เดิมไม่มีด่านตรวจสิทธิ์ — pendingFeeRequest.amount คือยอดที่ลูกความเห็นว่าต้องโอนให้ทนาย
        // และที่ทนายยืนยันรับ (direct-payment-actions) ต้องเป็นทนายของห้องนี้ (หรือแอดมิน) เท่านั้น
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
            text: `📋 **แจ้งชำระค่าบริการ:** ฿${amount.toLocaleString()}\nรายละเอียด: ${reason}\nกรุณาโอนให้ทนายโดยตรงตามข้อมูลบัญชีของทนาย (Lawslane ไม่ได้รับหรือถือเงินก้อนนี้)`,
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
            link: `/payment?chatId=${chatId}&type=additional`,
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

// การชำระเงินผ่านแพลตฟอร์ม (markInstallmentPaidAction / markCasePaidAction / ตรวจสลิป
// SlipOK / คูปอง / อีเมลแจ้งแอดมินทุกครั้งที่มีเงินเข้า) ถูกถอดออกแล้ว — ลูกความจ่ายทนายโดยตรง
// ดู direct-payment-actions.ts: notifyDirectPaymentAction (ลูกความแจ้งโอน ไม่เปลี่ยนสถานะเงิน)
// และ confirmDirectPaymentReceivedAction (ทนาย/แอดมินยืนยันรับเงิน)

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
 * ทนายของเคสหรือแอดมินยืนยันว่าได้รับเงินงวดนี้แล้ว
 *
 * คงชื่อเดิมไว้ให้ผู้เรียกเดิม (หน้าแชท) — ตัวจริงอยู่ที่ confirmDirectPaymentReceivedAction
 * เดิมยืนยันได้เฉพาะงวดที่ 'pending_verification' (มีสลิปรอตรวจ) ตอนนี้ยืนยันงวดที่ยังไม่จ่ายได้ทุกงวด
 * เพราะทนายเป็นคนเดียวที่รู้ว่าเงินเข้าบัญชีตัวเองแล้ว ไม่ว่าลูกความจะกดแจ้งโอนหรือไม่
 */
export async function approveInstallmentAction(chatId: string, installmentIndex: number) {
    const res = await confirmDirectPaymentReceivedAction({ chatId, type: 'installment', installmentIndex });
    return res.ok ? { success: true } : { success: false, error: res.error };
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

        const telemetryOn = await isTelemetryEnabled(db);
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
            // แชทฟรีเสมอ — ไม่มียอดค่าเปิดห้อง ค่าบริการ (ถ้ามี) ทนายเสนอภายหลังและลูกความจ่ายทนายโดยตรง
            amount: 0,
            hasNewMessage: true,
            lawyerReadStatus: 'unread',
            clientReadStatus: 'read',
            // Telemetry ชั้น A — เคสนี้ถูกสร้างพร้อมข้อความแรกของลูกความอยู่แล้ว
            // จึงต้องตั้งค่าเริ่มต้นตรงนี้ ไม่งั้นข้อความแรกจะไม่ถูกนับ
            // (มันไม่ได้ผ่าน sendChatMessageAction) — เขียนเฉพาะตอนเปิด telemetry
            ...(telemetryOn ? {
                msgCountClient: 1,
                msgCountLawyer: 0,
                firstClientMsgAt: admin.firestore.FieldValue.serverTimestamp(),
            } : {}),
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

        // Telemetry ชั้น B — เกาะ batch เดิม ไม่เพิ่ม round-trip
        if (telemetryOn) {
            addCaseEventToBatch(db, batch, {
                caseId: chatId, lawyerId, type: 'case_opened', actor: 'client',
            });
            addCaseEventToBatch(db, batch, {
                caseId: chatId, lawyerId, type: 'first_client_message', actor: 'client',
            });
        }

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
