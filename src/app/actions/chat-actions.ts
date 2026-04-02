'use server';

import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

/**
 * Ensures a chat document exists between two participants.
 */
export async function ensureChatExistsAction(chatId: string, participants: string[], caseTitle: string = 'คดี: มรดก') {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        const chatRef = db.collection('chats').doc(chatId);
        const chatSnap = await chatRef.get();

        if (!chatSnap.exists) {
            await chatRef.set({
                participants,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                caseTitle,
                status: 'active'
            });
        }
        return { success: true };
    } catch (error: any) {
        console.error("Error ensuring chat exists action:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Sends a chat message and updates parent chat metadata.
 * Also creates a notification for the recipient.
 */
export async function sendChatMessageAction(params: {
    chatId: string,
    text: string,
    senderId: string,
    senderName: string,
    recipientId: string,
    isLawyerView: boolean
}) {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    const { chatId, text, senderId, senderName, recipientId, isLawyerView } = params;

    try {
        const batch = db.batch();

        // 1. Add message to subcollection
        const messageRef = db.collection('chats').doc(chatId).collection('messages').doc();
        batch.set(messageRef, {
            text,
            senderId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 2. Update parent chat metadata
        const chatRef = db.collection('chats').doc(chatId);
        batch.update(chatRef, {
            lastMessage: text,
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            hasNewMessage: !isLawyerView,
            ...(isLawyerView ? { lawyerReadAt: admin.firestore.FieldValue.serverTimestamp() } : {})
        });

        // 3. Create Notification
        let notificationLink = '';
        if (isLawyerView) {
            notificationLink = `/chat/${chatId}?lawyerId=${senderId}`;
        } else {
            notificationLink = `/chat/${chatId}?lawyerId=${recipientId}&clientId=${senderId}&view=lawyer`;
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

        // 4. Trigger Real-time Notification (Email/LINE/Push) with Smart Checks
        const chatDoc = await db.collection('chats').doc(chatId).get();
        const chatData = chatDoc.data();
        const now = Date.now();
        const ACTIVE_THRESHOLD_MS = 90 * 1000; // 90 seconds
        const NOTIFICATION_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours (วันต่อวัน)

        if (!isLawyerView) {
            // Client sent message -> Notify Lawyer
            try {
                const lawyerDoc = await db.collection('lawyerProfiles').doc(recipientId).get();
                if (lawyerDoc.exists) {
                    const lawyerData = lawyerDoc.data() || {};
                    const lawyerSeenAt = chatData?.lawyerLastSeenAt?.toDate()?.getTime() || 0;
                    const lawyerLastNotifiedAt = chatData?.lawyerLastNotifiedAt?.toDate()?.getTime() || 0;

                    const isActive = (now - lawyerSeenAt) < ACTIVE_THRESHOLD_MS;
                    const isRecentlyNotified = (now - lawyerLastNotifiedAt) < NOTIFICATION_LIMIT_MS;

                    if (!isActive && !isRecentlyNotified && lawyerData.email) {
                        const { NotificationService } = await import('@/services/notification-service');
                        await NotificationService.notifyLawyerNewChat({
                            lawyerId: recipientId,
                            lawyerName: lawyerData.name || 'ทนายความ',
                            lawyerEmail: lawyerData.email,
                            lawyerLineId: lawyerData.lineId,
                            clientName: senderName,
                            messageSnippet: text.length > 100 ? text.substring(0, 100) + '...' : text,
                            chatId: chatId
                        });

                        // Update last notified timestamp
                        await db.collection('chats').doc(chatId).update({
                            lawyerLastNotifiedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
            } catch (notifyErr) {
                console.error("Error triggering lawyer notification:", notifyErr);
            }
        } else {
            // Lawyer sent message -> Notify Client
            try {
                const clientDoc = await db.collection('users').doc(recipientId).get();
                if (clientDoc.exists) {
                    const clientData = clientDoc.data() || {};
                    const clientSeenAt = chatData?.clientLastSeenAt?.toDate()?.getTime() || 0;
                    const clientLastNotifiedAt = chatData?.clientLastNotifiedAt?.toDate()?.getTime() || 0;

                    const isActive = (now - clientSeenAt) < ACTIVE_THRESHOLD_MS;
                    const isRecentlyNotified = (now - clientLastNotifiedAt) < NOTIFICATION_LIMIT_MS;

                    if (!isActive && !isRecentlyNotified && clientData.email) {
                        const { NotificationService } = await import('@/services/notification-service');
                        await NotificationService.notifyClientNewChat({
                            clientId: recipientId,
                            clientName: clientData.name || 'ลูกความ',
                            clientEmail: clientData.email,
                            lawyerName: senderName,
                            messageSnippet: text.length > 100 ? text.substring(0, 100) + '...' : text,
                            chatId: chatId
                        });

                        // Update last notified timestamp
                        await db.collection('chats').doc(chatId).update({
                            clientLastNotifiedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
            } catch (notifyErr) {
                console.error("Error triggering client notification:", notifyErr);
            }
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error sending chat message action:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Marks a chat as read by the lawyer.
 */
export async function markChatAsReadAction(chatId: string) {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        await db.collection('chats').doc(chatId).update({
            lawyerReadAt: admin.firestore.FieldValue.serverTimestamp(),
            hasNewMessage: false
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error marking chat as read action:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Handles a lawyer's request for a case opening fee.
 * Updates the chat document and notifies the client.
 */
export async function requestFeeAction(params: {
    chatId: string;
    lawyerId: string;
    lawyerName: string;
    amount: number;
    reason: string;
}) {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    const { chatId, lawyerId, lawyerName, amount, reason } = params;

    try {
        const chatRef = db.collection('chats').doc(chatId);
        const chatSnap = await chatRef.get();
        if (!chatSnap.exists) throw new Error('Chat not found');

        const chatData = chatSnap.data();
        const clientId = chatData?.participants?.find((p: string) => p !== lawyerId) || chatData?.userId;

        if (!clientId) throw new Error('Client not found for this chat');

        // 1. Update Firestore
        await chatRef.update({
            pendingFeeRequest: {
                amount,
                reason,
                requestedAt: admin.firestore.FieldValue.serverTimestamp()
            }
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

