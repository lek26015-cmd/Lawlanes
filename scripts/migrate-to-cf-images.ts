import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const CLOUDFLARE_IMAGES_TOKEN = process.env.CLOUDFLARE_IMAGES_TOKEN;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;

async function initAdmin() {
    if (admin.apps.length > 0) return admin.app();

    let rawKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!rawKey) throw new Error("FIREBASE_PRIVATE_KEY is missing");
    
    // Most robust cleanup
    const privateKey = rawKey
        .replace(/^"|"$/g, '') // Remove leading/trailing quotes
        .replace(/\\n/g, '\n')  // Convert literal \n to real newlines
        .trim();                // Remove any accidental wrapping whitespace

    console.log("Key Header:", privateKey.substring(0, 30));
    console.log("Key Footer:", privateKey.substring(privateKey.length - 30));
    
    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        }),
    });
}

async function uploadToCloudflare(url: string) {
    if (!CLOUDFLARE_IMAGES_TOKEN || !R2_ACCOUNT_ID) {
        throw new Error("Missing Cloudflare config");
    }

    console.log(`Uploading ${url} to Cloudflare Images...`);

    const formData = new FormData();
    formData.append('url', url);

    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/images/v1`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_IMAGES_TOKEN}`,
            },
            body: formData,
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Upload failed: ${JSON.stringify(error)}`);
    }

    const data: any = await response.json();
    return data.result.variants[0]; // Returns the first variant URL
}

async function migrateCollection(collectionName: string, imageField: string) {
    const admin = await initAdmin();
    if (!admin) return;
    const db = admin.firestore();

    console.log(`Migrating collection: ${collectionName}...`);
    const snapshot = await db.collection(collectionName).get();
    
    let migratedCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const imageUrl = data[imageField];

        if (imageUrl && !imageUrl.includes('imagedelivery.net') && (imageUrl.includes('r2.dev') || imageUrl.includes('firebasestorage'))) {
            try {
                const newUrl = await uploadToCloudflare(imageUrl);
                await doc.ref.update({ [imageField]: newUrl });
                console.log(`✅ Migrated ${doc.id}: ${newUrl}`);
                migratedCount++;
            } catch (err) {
                console.error(`❌ Failed to migrate ${doc.id}:`, err);
            }
        }
    }

    console.log(`Finished ${collectionName}. Migrated ${migratedCount} items.`);
}

async function run() {
    try {
        await migrateCollection('lawyerProfiles', 'imageUrl');
        await migrateCollection('articles', 'imageUrl');
        await migrateCollection('ads', 'imageUrl');
        await migrateCollection('landingPages', 'heroImage');
        console.log("Migration complete! 🎉");
    } catch (err) {
        console.error("Migration failed:", err);
    }
}

run();
