'use server';

import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { createContractFromChat } from '@/lib/contract-service';
import { requireUser, requireChatRole, AuthError } from '@/lib/auth-guard';
import { readSlipVerificationInTx } from '@/lib/slip-verification';
import { redeemCouponInTx, CouponRedeemError } from '@/lib/coupon-server';
import { getPendingAdditionalFee } from '@/lib/additional-fee';
import { resolvePaymentAmount } from '@/app/actions/payment-actions';

import { cookies } from 'next/headers';

/** เหตุผลที่ตั้งใจให้ผู้ใช้เห็นเมื่อ transaction การชำระเงินถูกปฏิเสธ (ไม่ export — ไฟล์ 'use server') */
class PaymentRejected extends Error {}

export async function getChatDetailsAction(chatId: string) {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const db = adminApp.firestore();

        // AUTH CHECK: Verify requester is a participant OR an admin
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session')?.value;
        if (!sessionCookie) return { success: false, error: 'Unauthorized: No session found.' };

        const decodedToken = await adminApp.auth().verifySessionCookie(sessionCookie);
        const requesterId = decodedToken.uid;
        const isRequesterAdmin = decodedToken.admin === true;

        const chatSnap = await db.collection('chats').doc(chatId).get();
        if (!chatSnap.exists) return { success: false, error: 'Chat not found.' };
        
        const data = chatSnap.data();
        if (!data) return { success: false, error: 'Chat data empty.' };
        
        const participants: string[] = data.participants || [];

        // ENHANCED AUTH CHECK: Allow if UID is in participants OR if this is the lawyer for this case
        let isAuthorizedLawyer = false;
        const lawyerProfileId = data.lawyerId;
        
        if (lawyerProfileId) {
            const lawyerProfileSnap = await db.collection('lawyerProfiles').doc(lawyerProfileId).get();
            if (lawyerProfileSnap.exists && lawyerProfileSnap.data()?.userId === requesterId) {
                isAuthorizedLawyer = true;
            }
        }

        if (!participants.includes(requesterId) && !isRequesterAdmin && !isAuthorizedLawyer) {
            console.warn(`[Security] Unauthorized access attempt to chat ${chatId} by user ${requesterId}`);
            return { success: false, error: 'Unauthorized access.' };
        }

        // REPAIR: Ensure lawyerId, clientId, and requesterId (if authorized) are in participants
        const lawyerId = data.lawyerId;
        const clientIdFromData = data.clientId || data.userId;
        
        let needsRepair = false;
        if (lawyerId && !participants.includes(lawyerId)) {
            needsRepair = true;
            participants.push(lawyerId);
        }
        if (clientIdFromData && !participants.includes(clientIdFromData)) {
            needsRepair = true;
            participants.push(clientIdFromData);
        }
        if (isAuthorizedLawyer && !participants.includes(requesterId)) {
            needsRepair = true;
            participants.push(requesterId);
        }

        if (needsRepair) {
            console.log(`[getChatDetailsAction] Repairing participants for chat ${chatId}`);
            await db.collection('chats').doc(chatId).update({
                participants: admin.firestore.FieldValue.arrayUnion(...participants)
            });
        }

        const clientId = clientIdFromData || participants.find(p => p !== lawyerId);
        
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

        // ENHANCED: Try to find the lawyer's actual UID for E2EE and dashboard sync
        let lawyerUserId = data.lawyerUserId || null;
        if (!lawyerUserId && lawyerId) {
            const lp = await db.collection('lawyerProfiles').doc(lawyerId).get();
            lawyerUserId = lp.data()?.userId || null;
        }

        return {
            success: true,
            isRequesterAdmin,
            data: JSON.parse(JSON.stringify({
                id: chatSnap.id,
                ...data,
                clientName, // Return the recovered name
                lawyerUserId, // Return the real UID
                createdAt: data?.createdAt?.toDate(),
                lastMessageAt: data?.lastMessageAt?.toDate()
            }))
        };
    } catch (error: any) {
        console.error("Error fetching chat details action:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Ensures a chat document exists between two participants.
 */
export async function ensureChatExistsAction(chatId: string, participants: string[], caseTitle: string = 'คดี: มรดก') {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const db = adminApp.firestore();

        const chatRef = db.collection('chats').doc(chatId);
        const chatSnap = await chatRef.get();

        if (!chatSnap.exists) {
            // NEW: Try to populate names from Auth immediately upon creation
            let clientName = 'ลูกความ';
            const clientId = participants.find(p => p.length > 20); // Basic heuristic for UID vs potential other IDs
            
            if (clientId) {
                try {
                    const userRecord = await adminApp.auth().getUser(clientId);
                    if (userRecord.displayName) clientName = userRecord.displayName;
                } catch (e) {}
            }

            await chatRef.set({
                participants,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                caseTitle,
                clientName,
                status: 'active'
            });
        } else {
            const data = chatSnap.data();
            const existingParticipants = data?.participants || [];
            
            // Check if participants list needs repair
            const missingParticipants = participants.filter(p => !existingParticipants.includes(p));
            if (missingParticipants.length > 0) {
                await chatRef.update({
                    participants: admin.firestore.FieldValue.arrayUnion(...missingParticipants)
                });
            }
        }
        return { success: true };
    } catch (error: any) {
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

        const { chatId, text, senderId, senderName, recipientId, isLawyerView, authToken, skipMessageSave, metadata } = params;

        // 0. Auth Verification — verify the caller is who they claim to be
        if (authToken) {
            try {
                const decodedToken = await adminApp.auth().verifyIdToken(authToken);
                if (decodedToken.uid !== senderId) {
                    console.error(`[Auth] Token UID mismatch: token=${decodedToken.uid}, senderId=${senderId}`);
                    return { success: false, error: 'Unauthorized: sender identity mismatch.' };
                }
            } catch (authErr: any) {
                console.error('[Auth] Token verification failed:', authErr.message);
                return { success: false, error: 'Unauthorized: invalid auth token.' };
            }
        } else {
            // No token provided — verify senderId is a participant or the authorized lawyer
            const chatSnap = await db.collection('chats').doc(chatId).get();
            if (!chatSnap.exists) return { success: false, error: 'Chat not found.' };
            
            const chatData = chatSnap.data();
            const participants: string[] = chatData?.participants || [];
            
            let isAuthorizedLawyer = false;
            if (chatData?.lawyerId) {
                const lpSnap = await db.collection('lawyerProfiles').doc(chatData.lawyerId).get();
                if (lpSnap.exists && lpSnap.data()?.userId === senderId) {
                    isAuthorizedLawyer = true;
                }
            }

            if (!participants.includes(senderId) && !isAuthorizedLawyer) {
                console.error(`[Auth] senderId ${senderId} is not a participant of chat ${chatId}`);
                return { success: false, error: 'Unauthorized: not a participant of this chat.' };
            }

            // AUTO-REPAIR: If authorized lawyer but not in participants, add them now
            if (isAuthorizedLawyer && !participants.includes(senderId)) {
                await db.collection('chats').doc(chatId).update({
                    participants: admin.firestore.FieldValue.arrayUnion(senderId)
                });
            }
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

        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
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
        try {
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
        console.error("Error sending chat message action:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Marks a chat as read by both lawyer or client.
 */
export async function markChatAsReadAction(chatId: string, isLawyerView: boolean = true) {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const db = adminApp.firestore();

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
            const cookieStore = await cookies();
            const sessionCookie = cookieStore.get('session')?.value;
            if (sessionCookie) {
                const decodedToken = await adminApp.auth().verifySessionCookie(sessionCookie);
                const userId = decodedToken.uid;
                
                const notificationsSnap = await db.collection('notifications')
                    .where('recipient', '==', userId)
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
            }
        } catch (notifErr) {
            console.warn("[markChatAsReadAction] Failed to clear notifications:", notifErr);
        }
        return { success: true };
    } catch (error: any) {
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
 * Sends email notifications after a payment is completed.
 * Called from the client-side payment page.
 */
export async function notifyPaymentCompletedAction(params: {
    chatId: string;
    lawyerId: string;
    amount: number;
    caseTitle: string;
    payerName: string;
    isAutoApproved: boolean;
    skipAdminNotification?: boolean;
}) {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const db = adminApp.firestore();

        const { chatId, lawyerId, amount, caseTitle, payerName, isAutoApproved, skipAdminNotification } = params;

        // Fetch lawyer info
        const lawyerDoc = await db.collection('lawyerProfiles').doc(lawyerId).get();
        const lawyerData = lawyerDoc.exists ? lawyerDoc.data() : null;
        const lawyerEmail = lawyerData?.email;
        const lawyerName = lawyerData?.name || 'ทนายความ';

        // Fetch client info from chat
        const chatDoc = await db.collection('chats').doc(chatId).get();
        const chatData = chatDoc.exists ? chatDoc.data() : null;
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
            console.log(`[notifyPaymentCompletedAction] Sending email to lawyer: ${lawyerEmail}`);
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
            console.warn(`[notifyPaymentCompletedAction] No lawyer email found for lawyerId: ${lawyerId}`);
        }

        // Confirm to client
        if (clientEmail) {
            console.log(`[notifyPaymentCompletedAction] Sending email to client: ${clientEmail}`);
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

        // Notify Admin only if not skipped
        if (!skipAdminNotification) {
            console.log(`[notifyPaymentCompletedAction] Sending email to admins`);
            await NotificationService.notifyAdminPaymentReceived({
                lawyerName,
                clientName,
                amount,
                caseTitle: caseTitle || chatData?.caseTitle || 'เคส',
                chatId,
                isAutoApproved,
            });
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error in notifyPaymentCompletedAction:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
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

        return {
            success: true,
            paidInstallments: outcome.paidInstallments,
            totalPaid: outcome.totalPaid,
            allPaid: outcome.allPaid,
            isFirstPayment: outcome.isFirstPayment,
            // หน้าเว็บใช้สองค่านี้ส่งอีเมลแจ้งเตือน — ต้องเป็นผลจาก server ไม่ใช่ตัวแปรในเบราว์เซอร์
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
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const db = adminApp.firestore();

        const chatRef = db.collection('chats').doc(chatId);
        const chatSnap = await chatRef.get();

        if (!chatSnap.exists) {
            return { success: false, error: 'ไม่พบห้องแชท' };
        }

        const data = chatSnap.data();
        const files = data?.files || [];
        const fileToRemove = files.find((f: any) => f.url === fileUrl);

        if (fileToRemove) {
            await chatRef.update({
                files: admin.firestore.FieldValue.arrayRemove(fileToRemove),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error in deleteFileAction:", error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการลบไฟล์' };
    }
}

/**
 * Sends a test email via NotificationService.
 */
export async function sendEmailAction(chatId: string, to: string, subject: string) {
    try {
        const { NotificationService } = await import('@/services/notification-service');
        const res = await NotificationService.sendEmail(to, subject, `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #2563eb;">Lawslane Notification Test</h2>
                <p>อีเมลฉบับนี้เป็นการทดสอบระบบแจ้งเตือนจากห้องแชท ID: <b>\${chatId}</b></p>
                <p>หากท่านได้รับข้อความนี้ แสดงว่าระบบการส่งอีเมลของ Lawslane ทำงานได้ปกติครับ</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #666;">ส่งเมื่อ: \${new Date().toLocaleString('th-TH')}</p>
            </div>
        `);
        return res;
    } catch (error: any) {
        console.error("Error in sendEmailAction:", error);
        return { success: false, error: error.message };
    }
}

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

        // หน้าเว็บใช้สองค่านี้ส่งอีเมลแจ้งเตือน — ต้องเป็นผลจาก server ไม่ใช่ตัวแปรในเบราว์เซอร์
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
                const { sendLawyerNewCaseEmail } = await import('@/app/actions/email');
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
