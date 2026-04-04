'use server';

import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import type { LawyerProfile } from '@/lib/types';

/**
 * Fetches a lawyer profile by ID using the Admin SDK.
 * This is used to bypass client-side permission restrictions.
 */
export async function getLawyerProfileAction(lawyerId: string): Promise<LawyerProfile | null> {
    const adminApp = await initAdmin();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized. Please check environment variables.');
    }
    const db = adminApp.firestore();

    try {
        const docSnap = await db.collection('lawyerProfiles').doc(lawyerId).get();
        if (docSnap.exists) {
            const data = docSnap.data() as any;
            
            // Helper to convert Firestore Timestamps to ISO strings or Dates
            const convertTimestamp = (val: any) => {
                if (val && typeof val.toDate === 'function') {
                    return val.toDate();
                }
                return val;
            };

            const result = {
                id: docSnap.id,
                ...data,
                dob: convertTimestamp(data?.dob),
                joinedAt: convertTimestamp(data?.joinedAt),
                createdAt: convertTimestamp(data?.createdAt),
            };

            return JSON.parse(JSON.stringify(result));
        }
        return null;
    } catch (error) {
        console.error("Error fetching lawyer profile action:", error);
        return null;
    }
}

/**
 * Updates lawyer pricing settings.
 */
export async function updateLawyerPricingAction(lawyerId: string, pricing: { 
    appointmentFee: number, 
    chatFee: number, 
    platformFeeRate: number 
}) {
    const adminApp = await initAdmin();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized.');
    }
    const db = adminApp.firestore();

    try {
        await db.collection('lawyerProfiles').doc(lawyerId).update({
            pricing: pricing,
            updatedAt: new Date().toISOString()
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error updating lawyer pricing action:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Fetches global platform settings (like GP rate).
 */
export async function getPlatformSettingsAction() {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        const settingsDoc = await db.collection('settings').doc('platform').get();
        if (settingsDoc.exists) {
            return JSON.parse(JSON.stringify(settingsDoc.data()));
        }
        return { platformFeeRate: 0.15 }; // Default fallback
    } catch (error) {
        console.error("Error fetching platform settings action:", error);
        return { platformFeeRate: 0.15 };
    }
}

/**
 * Checks the role of a specific user.
 */
export async function getUserRoleAction(userId: string) {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        return JSON.parse(JSON.stringify(userDoc.exists ? (userDoc.data()?.role || 'customer') : 'customer'));
    } catch (error) {
        console.error("Error fetching user role action:", error);
        return 'customer';
    }
}

/**
 * Adds a lawyer to the verified registry.
 */
export async function addToVerifiedRegistry(data: {
    licenseNumber: string;
    firstName: string;
    lastName: string;
    province: string;
}) {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        // Sanitize ID
        const docId = data.licenseNumber.replace(/\//g, '-');

        await db.collection('verifiedLawyers').doc(docId).set({
            licenseNumber: data.licenseNumber,
            firstName: data.firstName,
            lastName: data.lastName,
            province: data.province,
            status: 'pending',
            registeredDate: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error adding to verified registry action:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Creates or updates a manual case (Chat document) for a lawyer.
 */
export async function createManualCaseAction(lawyerId: string, data: {
    title: string;
    description: string;
    category: string;
    amount: number;
    installments?: { description: string, amount: string }[];
    clientInfo?: { name: string, address: string, taxId: string };
    existingChatId?: string;
    clientId?: string;
}) {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        const chatId = data.existingChatId || db.collection('chats').doc().id;
        const chatRef = db.collection('chats').doc(chatId);

        // Resolve clientId from existing chat if not provided
        let resolvedClientId = data.clientId;
        if (!resolvedClientId && data.existingChatId) {
            const existingChat = await chatRef.get();
            if (existingChat.exists) {
                const chatData = existingChat.data();
                resolvedClientId = chatData?.clientId || chatData?.userId || 
                    chatData?.participants?.find((p: string) => p !== lawyerId);
            }
        }

        const chatPayload: any = {
            lawyerId: lawyerId,
            caseTitle: data.title,
            description: data.description,
            category: data.category,
            amount: data.amount,
            status: 'pending_payment',
            isManualCase: true,
            installments: (data.installments || []).map((inst, idx) => ({
                ...inst,
                status: 'pending' as const,
                index: idx,
            })),
            paidInstallments: 0,
            totalPaid: 0,
            clientInfo: data.clientInfo || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMessage: `ข้อเสนอเปิดคดี: ${data.title} จำนวน ฿${data.amount.toLocaleString()}`,
        };

        // Set clientId/userId fields for easier querying
        if (resolvedClientId) {
            chatPayload.clientId = resolvedClientId;
            chatPayload.userId = resolvedClientId;
        }

        if (!data.existingChatId) {
            // New chat: include both lawyerId and clientId in participants
            chatPayload.participants = resolvedClientId 
                ? [lawyerId, resolvedClientId] 
                : [lawyerId];
            chatPayload.createdAt = admin.firestore.FieldValue.serverTimestamp();
        } else if (resolvedClientId) {
            // Existing chat: ensure clientId is in participants
            chatPayload.participants = admin.firestore.FieldValue.arrayUnion(lawyerId, resolvedClientId);
        }

        const chatRes = await chatRef.set(chatPayload, { merge: true });

        // BILLING FIX: Reset pending payment flags to prevent old consultation slips from being inherited
        await chatRef.update({
            hasNewPayment: false,
            pendingPaymentDetails: admin.firestore.FieldValue.delete(),
        });

        // FEED VISIBILITY FIX: Post a system message to the chat feed
        const messagesRef = chatRef.collection('messages');
        const newMessageRef = messagesRef.doc();
        const proposalMessage = {
            chatId: chatId,
            text: `📋 **ใบเสนอราคาใหม่:** ${data.title}\nจำนวนเงินรวม: ฿${data.amount.toLocaleString()}\nกรุณาตรวจสอบรายละเอียดและชำระเงินในเมนู "ข้อเสนอคดี"`,
            senderId: 'system',
            senderName: 'System',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'case_proposal',
            metadata: {
                caseTitle: data.title,
                amount: data.amount,
                isManualCase: true
            }
        };
        await newMessageRef.set(proposalMessage);

        // NOTIFICATION: Trigger Email/Push to the client
        if (resolvedClientId) {
            try {
                const { NotificationService } = await import('@/services/notification-service');
                const clientDoc = await db.collection('users').doc(resolvedClientId).get();
                const lawyerDoc = await db.collection('lawyerProfiles').doc(lawyerId).get();
                
                if (clientDoc.exists) {
                    const clientData = clientDoc.data();
                    const lawyerData = lawyerDoc.data();
                    
                    console.log(`[NotificationTrigger] Triggering emails for: ${clientData?.email}`);
                    if (!clientData?.email) {
                        console.error("❌ NotificationTrigger: Client email is missing in Firestore!");
                    }
                    
                    await NotificationService.notifyNewCaseProposal({
                        clientName: clientData?.name || 'ลูกความ',
                        clientEmail: clientData?.email || '',
                        lawyerName: lawyerData?.name || 'ทนายความ',
                        caseTitle: data.title,
                        amount: data.amount,
                        chatId: chatId,
                    });
                }
            } catch (notifyErr) {
                console.error("Non-blocking notification error:", notifyErr);
            }
        }

        // DUAL-WRITE: Create/Update the Pipeline document (legalCases)
        try {
            const legalCaseRef = db.collection('legalCases').doc(chatId);
            const legalCaseData: any = {
                lawyer_id: lawyerId,
                client_id: resolvedClientId || 'unknown',
                title: data.title,
                description: data.description,
                status: 'pending', // Initial status for Pipeline
                updatedAt: Date.now(),
            };

            // Only set createdAt if it doesn't exist
            const existingLegalCase = await legalCaseRef.get();
            if (!existingLegalCase.exists) {
                legalCaseData.createdAt = Date.now();
            }

            await legalCaseRef.set(legalCaseData, { merge: true });
        } catch (legalCaseErr) {
            console.error("Failed to sync legalCase to Pipeline (non-blocking):", legalCaseErr);
        }

        return JSON.parse(JSON.stringify({ success: true, chatId: chatId }));
    } catch (error: any) {
        console.error("Error creating/updating manual case action:", error);
        return JSON.parse(JSON.stringify({ success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' }));
    }
}

/**
 * Fetches unique clients who have interacted with a specific lawyer.
 */
export async function getLawyerClientsAction(lawyerId: string) {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        // Query chats where this lawyer is a participant
        const chatsSnap = await db.collection('chats')
            .where('participants', 'array-contains', lawyerId)
            .get();

        const clientIds = new Set<string>();
        chatsSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.participants) {
                data.participants.forEach((p: string) => {
                    if (p !== lawyerId) clientIds.add(p);
                });
            }
        });

        if (clientIds.size === 0) return [];

        const clients: any[] = [];
        const ids = Array.from(clientIds);
        
        // Firestore 'in' query limit is 30, but we'll use 10 for safety
        for (let i = 0; i < ids.length; i += 10) {
            const chunk = ids.slice(i, i + 10);
            const usersSnap = await db.collection('users')
                .where('__name__', 'in', chunk)
                .get();
            
            usersSnap.docs.forEach(doc => {
                const userData = doc.data();
                clients.push({
                    id: doc.id,
                    name: userData.name || 'Anonymous Client',
                    email: userData.email,
                    avatar: userData.avatar || ''
                });
            });
        }

        return JSON.parse(JSON.stringify(clients));
    } catch (error) {
        console.error("Error fetching lawyer clients:", error);
        return [];
    }
}
