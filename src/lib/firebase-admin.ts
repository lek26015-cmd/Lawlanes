import 'server-only';
import * as admin from 'firebase-admin';

/**
 * Expert implementation of Firebase Admin initialization for Next.js.
 * Handles malformed environment variables and prevents duplicate initialization.
 */
export async function initAdmin() {
    // 1. Singleton pattern: Check if an app already exists to prevent duplicate initialization
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const clean = (val: string | undefined) => {
        if (!val) return '';
        // Remove surrounding quotes and handle common escaping issues
        let cleaned = val.trim();
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.substring(1, cleaned.length - 1);
        }
        return cleaned.replace(/\\n/g, '\n');
    };

    const projectId = clean(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL);
    const privateKey = clean(process.env.FIREBASE_PRIVATE_KEY);
    const storageBucket = clean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

    try {
        if (projectId && clientEmail && privateKey) {
            console.log(`[Firebase Admin] Initializing for project: ${projectId} (Email: ${clientEmail.substring(0, 10)}...)`);
            return admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
                storageBucket,
            });
        } else {
            console.warn('[Firebase Admin] Incomplete service account. Using default credentials or environment-based auth.');
            return admin.initializeApp({
                projectId: projectId || undefined,
                storageBucket,
            });
        }
    } catch (error: any) {
        console.error('[Firebase Admin] Initialization failed:', error.message);
        return null;
    }
}

// Keeping createFirebaseAdminApp for backward compatibility if needed, 
// but redirecting to the new robust initAdmin logic.
export function createFirebaseAdminApp(params?: any) {
    return initAdmin();
}
