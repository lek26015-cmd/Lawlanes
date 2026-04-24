
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function initAdmin() {
    if (admin.apps.length > 0) return admin.app();

    const clean = (val: string | undefined) => {
        if (!val) return '';
        let cleaned = val.trim();
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.substring(1, cleaned.length - 1);
        }
        return cleaned.replace(/\\n/g, '\n');
    };

    const projectId = clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL);
    const privateKey = clean(process.env.FIREBASE_PRIVATE_KEY);
    const storageBucket = clean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
        }),
        storageBucket,
    });
}

async function testUpload() {
    try {
        console.log("Starting upload test...");
        const app = await initAdmin();
        const bucket = app.storage().bucket();
        
        const testContent = "This is a test file to verify the upload system.";
        const buffer = Buffer.from(testContent);
        const destination = `tests/test_${Date.now()}.txt`;
        const fileRef = bucket.file(destination);

        console.log(`Uploading to: ${destination}`);
        await fileRef.save(buffer, {
            metadata: { contentType: 'text/plain' },
            public: false
        });
        console.log("Upload successful!");

        console.log("Testing Signed URL generation...");
        const [url] = await fileRef.getSignedUrl({
            action: 'read',
            expires: Date.now() + 60000 // 1 minute
        });
        console.log("Signed URL:", url);
        
        console.log("Cleaning up test file...");
        await fileRef.delete();
        console.log("Cleanup successful!");
        
        console.log("✅ ALL TESTS PASSED");
    } catch (error) {
        console.error("❌ TEST FAILED:", error);
        process.exit(1);
    }
}

testUpload();
