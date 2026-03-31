'use server';

import { initAdmin } from '@/lib/firebase-admin';
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

            return {
                id: docSnap.id,
                ...data,
                dob: convertTimestamp(data?.dob),
                joinedAt: convertTimestamp(data?.joinedAt),
                createdAt: convertTimestamp(data?.createdAt),
            } as LawyerProfile;
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
            return settingsDoc.data();
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
        if (userDoc.exists) {
            return userDoc.data()?.role || 'customer';
        }
        return 'customer';
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
 * Creates a new manual case (Chat document) for a lawyer.
 */
export async function createManualCaseAction(lawyerId: string, data: {
    title: string;
    description: string;
    category: string;
    amount: number;
    installments?: { description: string, amount: string }[];
    clientInfo?: { name: string, address: string, taxId: string };
}) {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        const chatRef = db.collection('chats').doc();
        const chatId = chatRef.id;

        const chatPayload = {
            lawyerId: lawyerId,
            participants: [lawyerId], // Client will be added upon payment
            caseTitle: data.title,
            description: data.description,
            category: data.category,
            amount: data.amount,
            status: 'active', // Case is created and active, waiting for client
            isManualCase: true,
            installments: data.installments || [],
            clientInfo: data.clientInfo || null,
            createdAt: new Date(),
            lastMessageAt: new Date(),
            lastMessage: 'คดีถูกสร้างเรียบร้อยแล้ว กรุณาชำระเงินเพื่อเริ่มดำเนินการ',
        };

        await chatRef.set(chatPayload);

        return { success: true, chatId: chatId };
    } catch (error: any) {
        console.error("Error creating manual case action:", error);
        return { success: false, error: error.message };
    }
}
