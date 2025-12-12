import 'server-only';
import * as admin from 'firebase-admin';

interface FirebaseAdminAppParams {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

function formatPrivateKey(key: string) {
    return key.replace(/\\n/g, '\n');
}

export function createFirebaseAdminApp(params: FirebaseAdminAppParams) {
    const privateKey = formatPrivateKey(params.privateKey);

    if (admin.apps.length > 0) {
        return admin.app();
    }

    const cert = admin.credential.cert({
        projectId: params.projectId,
        clientEmail: params.clientEmail,
        privateKey: privateKey,
    });

    return admin.initializeApp({
        credential: cert,
        projectId: params.projectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
}

export async function initAdmin() {
    const params = {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
        privateKey: process.env.FIREBASE_PRIVATE_KEY as string,
    };

    if (!params.clientEmail || !params.privateKey) {
        // Fallback for local dev without specific env vars, might rely on default creds
        if (admin.apps.length > 0) return admin.app();
        // If no env vars, we can't really init properly unless using default creds
        // But let's try default if envs are missing
        try {
            return admin.initializeApp();
        } catch (e) {
            console.error("Failed to initialize Firebase Admin with default credentials or env vars missing.");
            return null;
        }
    }

    return createFirebaseAdminApp(params);
}
