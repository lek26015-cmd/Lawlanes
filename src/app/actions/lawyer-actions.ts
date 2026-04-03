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
        return { success: false, error: error.message };
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
        return { success: false, error: error.message };
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
            installments: data.installments || [],
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

        await chatRef.set(chatPayload, { merge: true });

        return { success: true, chatId: chatId };
    } catch (error: any) {
        console.error("Error creating/updating manual case action:", error);
        return { success: false, error: error.message };
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
