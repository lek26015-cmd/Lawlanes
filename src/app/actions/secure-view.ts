'use server';

import { initAdmin } from '@/lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';

/**
 * Generates a temporary signed URL for a file in Firebase Storage.
 * This should be used to display private documents to authorized users (Admins/Lawyers).
 * 
 * @param path The storage path of the file
 * @param expiresAt Optional expiration time (default 1 hour)
 * @returns The signed URL
 */
export async function getSecureDownloadUrl(path: string, expiresAt: number = Date.now() + 3600000) {
    if (!path) return null;
    
    // If it's already a full URL (legacy R2 data), return as is
    if (path.startsWith('http')) return path;

    const app = await initAdmin();
    if (!app) {
        throw new Error('Firebase Admin initialization failed');
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
