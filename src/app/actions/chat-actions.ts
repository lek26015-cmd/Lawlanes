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

        // 4. Trigger Real-time Notification (Email/LINE) via Background Worker
        if (!isLawyerView) {
            try {
                // Fetch lawyer profile to get email/lineId (recipientId is the lawyer in this case)
                const lawyerDoc = await db.collection('lawyerProfiles').doc(recipientId).get();
                if (lawyerDoc.exists) {
                    const lawyerData = lawyerDoc.data();
                    if (lawyerData?.email) {
                        const { NotificationService } = await import('@/services/notification-service');
                        // Non-blocking trigger
                        NotificationService.notifyLawyerNewChat({
                            lawyerId: recipientId,
                            lawyerName: lawyerData.name || 'ทนายความ',
                            lawyerEmail: lawyerData.email,
                            lawyerLineId: lawyerData.lineId,
                            clientName: senderName,
                            messageSnippet: text.length > 100 ? text.substring(0, 100) + '...' : text,
                            chatId: chatId
                        }).catch(e => console.error("Async notification error:", e));
                    }
                }
            } catch (notifyErr) {
                console.error("Error triggering chat notification:", notifyErr);
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
