'use server';

import { initAdmin } from '@/lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';

import { cookies } from 'next/headers';

/**
 * Generates a temporary signed URL for a file in Firebase Storage.
 * This should be used to display private documents to authorized users (Admins/Lawyers/Clients).
 * 
 * @param path The storage path of the file
 * @param chatId Optional chatId to verify access rights (Participant check)
 * @param expiresAt Optional expiration time (default 1 hour)
 * @returns The signed URL
 */
export async function getSecureDownloadUrl(path: string, chatId?: string, expiresAt: number = Date.now() + 300000) {
    if (!path) return null;
    
    // If it's already a full URL (legacy R2 data), return as is
    if (path.startsWith('http')) return path;

    // Handle Base64 from Firestore SlipImages
    if (path.startsWith('base64_slip_')) {
        const id = path.replace('base64_slip_', '');
        const app = await initAdmin();
        if (!app) return null;
        const db = app.firestore();
        try {
            const docSnap = await db.collection('slipImages').doc(id).get();
            if (docSnap.exists) {
                const data = docSnap.data();
                if (data && data.base64Data) {
                    return data.base64Data as string;
                }
            }
        } catch (error) {
            console.error("Error fetching base64 slip:", error);
            return null;
        }
        return null;
    }

    const app = await initAdmin();
    if (!app) {
        throw new Error('Firebase Admin initialization failed');
    }
    const db = app.firestore();

    // --- SECURITY CHECK ---
    // 1. Verify User Session
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) {
        console.warn(`[Security] Unauthorized download attempt: No session for ${path}`);
        return null;
    }

    try {
        const decodedToken = await app.auth().verifySessionCookie(sessionCookie);
        const requesterId = decodedToken.uid;
        const isAdmin = decodedToken.admin === true;

        // 2. If chatId is provided, verify participant status
        if (chatId) {
            const chatSnap = await db.collection('chats').doc(chatId).get();
            if (!chatSnap.exists) return null;
            
            const chatData = chatSnap.data();
            const participants: string[] = chatData?.participants || [];
            
            if (!participants.includes(requesterId) && !isAdmin) {
                console.error(`[Security] Unauthorized access attempt to file ${path} by user ${requesterId}`);
                return null;
            }
        } else if (!isAdmin) {
            // If no chatId is provided, only allow Admins to generate URLs via this generic action
            // This protects slips or other loose files.
            console.warn(`[Security] Non-admin attempt to access generic file ${path} without chatId context.`);
            return null;
        }
    } catch (authErr) {
        console.error("[Security] Auth verification failed during secure download:", authErr);
        return null;
    }

    const bucket = getStorage(app).bucket();
    const file = bucket.file(path);

    try {
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: expiresAt,
        });
        return url;
    } catch (error) {
        console.error("Error generating signed URL:", error);
        return null;
    }
}
