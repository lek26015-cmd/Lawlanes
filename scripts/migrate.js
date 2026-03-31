const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const CLOUDFLARE_IMAGES_TOKEN = process.env.CLOUDFLARE_IMAGES_TOKEN;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;

async function initAdmin() {
    if (admin.apps.length > 0) return admin.app();

    let rawKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!rawKey) throw new Error("FIREBASE_PRIVATE_KEY is missing");
    
    // Normalize: strip everything except the base64 content, then wrap properly
    const content = rawKey
        .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, '')
        .replace(/\\n/g, '')
        .replace(/\n/g, '')
        .replace(/"/g, '')
        .trim();
    
    const privateKey = `-----BEGIN PRIVATE KEY-----\n${content}\n-----END PRIVATE KEY-----\n`;

    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        }),
    });
}

async function uploadToCloudflare(url) {
    const formData = new URLSearchParams();
    formData.append('url', url);

    const response = await fetch(
        `https://api.cloudflare.com/accounts/${R2_ACCOUNT_ID}/images/v1`,
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

    const data = await response.json();
    return data.result.variants[0];
}

async function migrateCollection(db, collectionName, imageField) {
    console.log(`Migrating ${collectionName}...`);
    const snapshot = await db.collection(collectionName).get();
    let count = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const imageUrl = data[imageField];

        if (imageUrl && !imageUrl.includes('imagedelivery.net') && (imageUrl.includes('r2.dev') || imageUrl.includes('firebasestorage'))) {
            try {
                const newUrl = await uploadToCloudflare(imageUrl);
                await doc.ref.update({ [imageField]: newUrl });
                console.log(`✅ ${collectionName} ${doc.id} -> ${newUrl}`);
                count++;
            } catch (err) {
                console.error(`❌ ${collectionName} ${doc.id}: ${err.message}`);
            }
        }
    }
    console.log(`Done ${collectionName}: ${count} items.`);
}

async function main() {
    try {
        const app = await initAdmin();
        const db = app.firestore();
        await migrateCollection(db, 'lawyerProfiles', 'imageUrl');
        await migrateCollection(db, 'articles', 'imageUrl');
        console.log("Migration finished! 🎉");
    } catch (err) {
        console.error("Fatal error:", err);
    }
}

main();
