'use server';

import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { checkRateLimit } from '@/lib/security/rate-limiter';

export async function getChatDetailsAction(chatId: string) {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const db = adminApp.firestore();

        const chatSnap = await db.collection('chats').doc(chatId).get();
        if (!chatSnap.exists) return { success: false, error: 'Chat not found.' };
        
        const data = chatSnap.data();
        return {
            success: true,
            data: JSON.parse(JSON.stringify({
                id: chatSnap.id,
                ...data,
                createdAt: data?.createdAt?.toDate(),
                lastMessageAt: data?.lastMessageAt?.toDate()
            }))
        };
    } catch (error: any) {
        console.error("Error fetching chat details action:", error);
        return { success: false, error: error.message };
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
            await chatRef.set({
                participants,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                caseTitle,
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
        return { success: false, error: error.message };
    }
}

export async function sendChatMessageAction(params: {
    chatId: string,
    text: string,
    senderId: string,
    senderName: string,
    recipientId: string,
    isLawyerView: boolean
}) {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const db = adminApp.firestore();

        const { chatId, text, senderId, senderName, recipientId, isLawyerView } = params;

        // 1. Rate Limiting Protection (10 messages per 5 seconds)
        const rateCheck = await checkRateLimit(senderId, 10, 5000);
        if (!rateCheck.success) {
            return { success: false, error: 'ส่งข้อความบ่อยเกินไป กรุณารอสักครู่ (Rate limit exceeded)' };
        }

        const batch = db.batch();

        // 2. Add message to subcollection
        const messageRef = db.collection('chats').doc(chatId).collection('messages').doc();
        batch.set(messageRef, {
            text,
            senderId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 3. Update parent chat metadata
        const chatRef = db.collection('chats').doc(chatId);
        batch.update(chatRef, {
            lastMessage: text,
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            hasNewMessage: !isLawyerView,
            ...(isLawyerView ? { lawyerReadAt: admin.firestore.FieldValue.serverTimestamp(), lawyerReadStatus: 'read' } : { clientReadStatus: 'unread' })
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
            type: 'chat_message',
            title: `ข้อความใหม่จาก ${senderName}`,
            message: text.length > 50 ? text.substring(0, 50) + '...' : text,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
            recipient: recipientId,
            link: notificationLink,
            relatedId: chatId
        });

        await batch.commit();

        // 5. Trigger Real-time Notification (Email/Push)
        // ... (existing logic for smart notifications) ...
        const chatDoc = await db.collection('chats').doc(chatId).get();
        const chatData = chatDoc.data();
        const now = Date.now();
        const ACTIVE_THRESHOLD_MS = 90 * 1000;

        if (!isLawyerView) {
            try {
                const lawyerDoc = await db.collection('lawyerProfiles').doc(recipientId).get();
                if (lawyerDoc.exists) {
                    const lawyerData = lawyerDoc.data() || {};
                    const lawyerSeenAt = chatData?.lawyerLastSeenAt?.toDate()?.getTime() || 0;
                    const isActive = (now - lawyerSeenAt) < ACTIVE_THRESHOLD_MS;
                    if (!isActive && lawyerData.email) {
                        const { NotificationService } = await import('@/services/notification-service');
                        await NotificationService.notifyLawyerNewChat({
                            lawyerId: recipientId,
                            lawyerName: lawyerData.name || 'ทนายความ',
                            lawyerEmail: lawyerData.email,
                            clientName: senderName,
                            messageSnippet: text.substring(0, 100),
                            chatId
                        });
                    }
                }
            } catch (e) { console.error("Notify fail:", e); }
        } else {
            try {
                const clientDoc = await db.collection('users').doc(recipientId).get();
                if (clientDoc.exists) {
                    const clientData = clientDoc.data() || {};
                    const clientSeenAt = chatData?.clientLastSeenAt?.toDate()?.getTime() || 0;
                    const isActive = (now - clientSeenAt) < ACTIVE_THRESHOLD_MS;
                    if (!isActive && clientData.email) {
                        const { NotificationService } = await import('@/services/notification-service');
                        await NotificationService.notifyClientNewChat({
                            clientId: recipientId,
                            clientName: clientData.name || 'ลูกความ',
                            clientEmail: clientData.email,
                            lawyerName: senderName,
                            messageSnippet: text.substring(0, 100),
                            chatId
                        });
                    }
                }
            } catch (e) { console.error("Notify fail:", e); }
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error sending chat message action:", error);
        return { success: false, error: error.message };
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
            updateData.lawyerReadStatus = 'read';
            updateData.hasNewMessage = false;
        } else {
            updateData.clientReadAt = admin.firestore.FieldValue.serverTimestamp();
            updateData.clientReadStatus = 'read';
        }

        await db.collection('chats').doc(chatId).update(updateData);
        return { success: true };
    } catch (error: any) {
        console.error("Error marking chat as read action:", error);
        return { success: false, error: error.message };
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

        // 2. Trigger Notification
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
        console.error("Error in requestFeeAction:", error);
        return { success: false, error: error.message };
    }
}

