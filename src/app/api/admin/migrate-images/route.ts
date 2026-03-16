import { NextResponse } from 'next/server';
import { initAdmin, createFirebaseAdminApp } from '@/lib/firebase-admin';
import { uploadToCloudflareImages } from '@/app/actions/upload-cloudflare-images';

// We need a way to access the formatting logic for debug
// Let's just import it or replicate it exactly
function formatPrivateKey(key: string) {
    if (!key) return key;
    const cleanedKey = key.replace(/^"|"$/g, '');
    const header = '-----BEGIN PRIVATE KEY-----';
    const footer = '-----END PRIVATE KEY-----';
    let base64 = cleanedKey
        .replace(header, '')
        .replace(footer, '')
        .replace(/\\n/g, '')
        .replace(/\s+/g, '');
    return `${header}\n${base64}\n${footer}\n`;
}

export async function GET() {
    // Basic security: only allow in development or with a secret
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
    }

    try {
        const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
        const rawChars = Array.from(rawKey.substring(0, 50)).map(c => c.charCodeAt(0).toString(16)).join(' ');
        
        const privateKey = (rawKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n').trim());
        
        const debug = {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            rawLength: rawKey.length,
            rawHex: rawChars,
            rawStart: rawKey.substring(0, 30),
            rawEnd: rawKey.substring(rawKey.length - 30),
            formattedLength: privateKey.length,
            formattedStart: privateKey.substring(0, 30),
            formattedEnd: privateKey.substring(privateKey.length - 30)
        };

        const adminApp = await initAdmin();
        if (!adminApp) throw new Error('Firebase Admin not initialized');
        const db = adminApp.firestore();

        const results: any = {};

        const collections = [
            { name: 'lawyerProfiles', field: 'imageUrl' },
            { name: 'articles', field: 'imageUrl' },
            { name: 'ads', field: 'imageUrl' }
        ];

        for (const col of collections) {
            console.log(`Migrating ${col.name}...`);
            const snapshot = await db.collection(col.name).get();
            let count = 0;
            let skipped = 0;
            let failed = 0;

            for (const doc of snapshot.docs) {
                const data = doc.data();
                const imageUrl = data[col.field];

                if (imageUrl && !imageUrl.includes('imagedelivery.net') && (imageUrl.includes('r2.dev') || imageUrl.includes('firebasestorage'))) {
                    try {
                        // Create a temporary FormData for the server action
                        const formData = new FormData();
                        // We need to fetch the image first and convert to blob, 
                        // or modify uploadToCloudflareImages to accept URL
                        
                        const imgRes = await fetch(imageUrl);
                        const blob = await imgRes.blob();
                        formData.append('file', blob, 'image.jpg');

                        const newUrl = await uploadToCloudflareImages(formData);
                        if (newUrl) {
                            await doc.ref.update({ [col.field]: newUrl });
                            count++;
                        } else {
                            failed++;
                        }
                    } catch (err) {
                        console.error(`Error migrating ${col.name} ${doc.id}:`, err);
                        failed++;
                    }
                } else {
                    skipped++;
                }
            }
            results[col.name] = { migrated: count, skipped, failed };
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
        const rawChars = Array.from(rawKey.substring(0, 50)).map(c => c.charCodeAt(0).toString(16)).join(' ');
        const rawCharsEnd = Array.from(rawKey.substring(rawKey.length - 50)).map(c => c.charCodeAt(0).toString(16)).join(' ');
        const privateKey = formatPrivateKey(rawKey);
        const debug = {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            rawLength: rawKey.length,
            rawHex: rawChars,
            rawHexEnd: rawCharsEnd,
            formattedLength: privateKey.length,
            formattedStart: privateKey.substring(0, 30),
            formattedEnd: privateKey.substring(privateKey.length - 30)
        };
        console.error('Migration error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message,
            debug 
        }, { status: 500 });
    }
}
