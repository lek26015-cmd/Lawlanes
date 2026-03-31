import 'server-only';


import * as admin from 'firebase-admin';

interface FirebaseAdminAppParams {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

function formatPrivateKey(key: string) {
    if (!key) return key;
    
    // 0. Detect if it's a JSON (common mistake: pasting the whole service account json)
    if (key.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(key);
            if (parsed.private_key) {
                console.log('[Firebase Diagnostics] Detected service account JSON, extracting private_key');
                key = parsed.private_key;
            }
        } catch (e) {
            // Not valid JSON, continue with normal processing
        }
    }

    // 1. Initial cleanup: unescape and remove quotes
    let cleaned = key.trim().replace(/^"|"$/g, '').trim();
    cleaned = cleaned.replace(/\\n/g, '\n').replace(/\\r/g, '\r');

    // 2. Normalize: Remove ALL whitespace to handle keys broken by bad copy-pasting
    const normalized = cleaned.replace(/\s+/g, '');

    // 3. Extract boundaries
    // We look for BEGIN and END blocks. We are liberal with what's inside.
    const beginMatch = normalized.match(/-----BEGIN([^-]+)-----/);
    const endMatch = normalized.match(/-----END([^-]+)-----/);

    let base64Body = '';
    let headerType = 'PRIVATE KEY';

    if (beginMatch && endMatch) {
        // We found markers! 
        const typeStr = beginMatch[1]; // e.g., "RSAPRIVATEKEY" or "PRIVATEKEY"
        if (typeStr.toUpperCase().includes('RSA')) {
            headerType = 'RSA PRIVATE KEY';
        }

        // The body is everything between the markers
        const startIndex = normalized.indexOf(beginMatch[0]) + beginMatch[0].length;
        const endIndex = normalized.lastIndexOf(endMatch[0]);
        base64Body = normalized.substring(startIndex, endIndex);
        
        // Safety check: if there's another marker inside this "body", we might have multiple keys
        if (base64Body.includes('-----BEGIN') || base64Body.includes('-----END')) {
            console.warn('[Firebase Diagnostics] WARNING: Multiple keys or internal markers detected. Stripping inner markers.');
            base64Body = base64Body
                .replace(/-----BEGIN[^-]*-----/g, '')
                .replace(/-----END[^-]*-----/g, '');
        }
    } else {
        // No markers found. Treat as raw base64. 
        // We strip anything that looks like a broken marker just in case.
        base64Body = normalized
            .replace(/-----BEGIN[^-]*-----/g, '')
            .replace(/-----END[^-]*-----/g, '')
            .replace(/BEGIN|END|PRIVATE|KEY/g, ''); // Highly aggressive
    }

    // 4. Final body cleanup: Keep ONLY valid base64 characters
    base64Body = base64Body.replace(/[^A-Za-z0-9+/=]/g, '');

    if (!base64Body) {
        console.warn('[Firebase Diagnostics] Metadata: Key body extracted is EMPTY.');
        return key;
    }

    // 5. Build canonical PEM with 64-character wrapping
    const wrappedBody = base64Body.match(/.{1,64}/g)?.join('\n') || base64Body;
    const finalKey = `-----BEGIN ${headerType}-----\n${wrappedBody}\n-----END ${headerType}-----\n`;
    
    console.log(`[Firebase Diagnostics] Metadata: HeaderType=${headerType}, BodyLength=${base64Body.length}, FormattedLength=${finalKey.length}`);
    console.log(`[Firebase Diagnostics] Key Preview: ${finalKey.substring(0, 30)}...${finalKey.substring(finalKey.length - 30)}`.trim());
    
    return finalKey;
}

export function createFirebaseAdminApp(params: FirebaseAdminAppParams) {
    console.log('[Firebase Diagnostics] Creating App with ProjectID:', params.projectId, 'ClientEmail:', params.clientEmail);
    const privateKey = formatPrivateKey(params.privateKey);

    if (admin.apps.length > 0) {
        try {
            const app = admin.app();
            console.log('[Firebase Diagnostics] Deleting existing app for re-initialization');
            app.delete();
        } catch (e) {
            // App might not exist or already deleted
        }
    }

    try {
        const cert = admin.credential.cert({
            projectId: params.projectId.trim(),
            clientEmail: params.clientEmail.trim(),
            privateKey: privateKey,
        });

        console.log('[Firebase Diagnostics] Initializing App with cert...');
        const app = admin.initializeApp({
            credential: cert,
            projectId: params.projectId.trim(),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
        console.log('[Firebase Diagnostics] Successfully initialized app');
        return app;
    } catch (err: any) {
        console.error('[Firebase Diagnostics] CRITICAL: initialization failed inside createFirebaseAdminApp:', {
            message: err.message,
            code: err.code,
            stack: err.stack,
            // Provide a hint for common private key errors
            hint: err.message.includes('ASN.1') ? 'Possible malformed private key or PKCS#1/PKCS#8 mismatch' : 'Check project credentials and permissions'
        });
        throw err;
    }
}

export async function initAdmin() {
    const params = {
        projectId: (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '').trim(),
        clientEmail: (process.env.FIREBASE_CLIENT_EMAIL || '').trim(),
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || ''),
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
