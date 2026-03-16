import 'server-only';


import * as admin from 'firebase-admin';

interface FirebaseAdminAppParams {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

function formatPrivateKey(key: string) {
    if (!key) return key;
    
    // Remove potential surrounding quotes from .env
    const cleanedKey = key.replace(/^"|"$/g, '');
    
    // Regex to match any PEM header/footer (allows for variation in whitespace)
    const headerRegex = /-----BEGIN[^-]+-----/g;
    const footerRegex = /-----END[^-]+-----/g;
    
    // Header and footer for reconstruction
    const header = '-----BEGIN PRIVATE KEY-----';
    const footer = '-----END PRIVATE KEY-----';
    
    // Strip headers, footers, and ALL whitespace/newlines (including literal \n)
    let base64 = cleanedKey
        .replace(headerRegex, '')
        .replace(footerRegex, '')
        .replace(/\\n/g, '')
        .replace(/\s+/g, '');
        
    // Reconstruct with proper PEM format
    return `${header}\n${base64}\n${footer}\n`;
}

export function createFirebaseAdminApp(params: FirebaseAdminAppParams) {
    const privateKey = formatPrivateKey(params.privateKey);

    if (admin.apps.length > 0) {
        // In development, we might want to re-initialize if the key changed
        // For now, let's just delete the existing one and re-init to be sure.
        try {
            const app = admin.app();
            app.delete();
        } catch (e) {
            // App might not exist or already deleted
        }
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
