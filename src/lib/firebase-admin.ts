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

    // 2. Read and clean environment variables
    // We strip accidental double quotes that often appear in cloud environment configs or .env files
    const projectId = (process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '').replace(/"/g, '');
    const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').replace(/"/g, '');
    let privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/"/g, '');

    // 3. Handle Private Key formatting: Fix newline characters if they are escaped as literal '\n'
    if (privateKey) {
        privateKey = privateKey.replace(/\\n/g, '\n');
    }

    // 4. Add Error Handling & Fallback
    try {
        if (projectId && clientEmail && privateKey) {
            console.log('[Firebase Admin] Initializing with service account credentials');
            return admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            });
        } else {
            // Fallback for local development or environments with Default Application Credentials
            console.warn('[Firebase Admin] Missing explicit credentials. Falling back to default initialization.');
            return admin.initializeApp({
                projectId: projectId || undefined,
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            });
        }
    } catch (error: any) {
        console.error('[Firebase Admin] CRITICAL: Initialization failed:', error.message);
        // We return null so calling actions can handle the failure gracefully
        return null;
    }
}

// Keeping createFirebaseAdminApp for backward compatibility if needed, 
// but redirecting to the new robust initAdmin logic.
export function createFirebaseAdminApp(params?: any) {
    return initAdmin();
}
