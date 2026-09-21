'use server';

import { initAdmin } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { requireUser } from '@/lib/auth-guard';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB

const ALLOWED_CONTENT_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
    'application/pdf',
]);

// โฟลเดอร์ปลายทางต้องตรงกับที่แอปใช้จริงเท่านั้น
// เดิม folder มาจากผู้เรียกแบบอิสระ → เขียน object ไป prefix ไหนก็ได้
const ALLOWED_FOLDERS: RegExp[] = [
    /^uploads$/,
    /^public$/,
    /^profile-images$/,
    /^payment-slips$/,
    /^lawyer_documents\/[A-Za-z0-9_-]+$/,
    /^support\/[A-Za-z0-9_-]+$/,
    /^chats\/[A-Za-z0-9_-]+$/,
    /^case_evidence\/[A-Za-z0-9_-]+$/,
];

/**
 * ด่านร่วมของทุก upload action: ต้องล็อกอิน + โฟลเดอร์อยู่ใน allowlist
 * + จำกัดชนิดและขนาดไฟล์ · คืน uid ไว้ใช้บันทึกว่าใครอัปโหลด
 */
async function assertUploadAllowed(file: File | null, folder?: string): Promise<string> {
    const { uid } = await requireUser();

    if (!file) {
        throw new Error('No file provided');
    }
    if (folder !== undefined && !ALLOWED_FOLDERS.some((re) => re.test(folder))) {
        throw new Error('Invalid upload destination');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error('File is too large');
    }
    if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
        throw new Error('Unsupported file type');
    }
    return uid;
}

// ============================================================================
// Cloudflare Images Upload
// ============================================================================

/**
 * Uploads an image to Cloudflare Images CDN.
 * Best for: profile pictures, article images, marketing assets.
 */
export async function uploadToCloudflareImages(formData: FormData) {
    await assertUploadAllowed(formData.get('file') as File | null);
    const file = formData.get('file') as File;
    if (!file) {
        throw new Error('No file provided');
    }

    const accountId = process.env.R2_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_IMAGES_TOKEN;

    if (!accountId || !apiToken) {
        console.error("Missing Cloudflare Images configuration");
        throw new Error('Cloudflare Images not configured. Please add CLOUDFLARE_IMAGES_TOKEN to .env.local');
    }

    try {
        console.log(`[Server Action] Uploading to Cloudflare Images...`);

        const cfFormData = new FormData();
        cfFormData.append('file', file);

        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                },
                body: cfFormData,
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Cloudflare Images Upload Error:", errorData);
            throw new Error(errorData.errors?.[0]?.message || 'Failed to upload to Cloudflare Images');
        }

        const data = await response.json();
        const variants = data.result.variants || [];
        const publicUrl = variants.length > 0 ? variants[0] : null;

        if (!publicUrl) {
            throw new Error('No delivery variants found for uploaded image');
        }

        console.log(`[Server Action] Cloudflare Images upload success: ${publicUrl}`);
        return publicUrl;

    } catch (error: any) {
        console.error("Cloudflare Images Upload Error:", error);
        throw new Error(error.message || 'Failed to upload to Cloudflare Images');
    }
}

// ============================================================================
// Cloudflare R2 Upload
// ============================================================================

/**
 * Uploads a file to Cloudflare R2 Storage.
 * Best for: documents, PDFs, non-image files.
 */
export async function uploadToR2(formData: FormData, folder: string = 'uploads') {
    const file = formData.get('file') as File;
    await assertUploadAllowed(file, folder);

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const timestamp = Date.now();
        const extension = file.name.split('.').pop() || 'bin';
        const filename = `${uuidv4()}_${timestamp}.${extension}`;
        const key = `${folder}/${filename}`;

        console.log(`[R2 Upload] Preparing upload: ${key} (${buffer.length} bytes)`);

        const { r2 } = await import('@/lib/r2');
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: file.type || 'application/octet-stream',
        });

        await r2.send(command);

        const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
        console.log(`[R2 Upload] Success: ${publicUrl}`);
        
        return publicUrl;

    } catch (error: any) {
        console.error("R2 Upload Error:", error);
        throw new Error(`Failed to upload to R2: ${error.message}`);
    }
}

// ============================================================================
// Firebase Storage Upload (Secure / Public)
// ============================================================================

/**
 * Uploads a file to Firebase Storage securely (private).
 * Best for: sensitive documents like ID cards, licenses, legal docs.
 * Returns the storage path (not a public URL).
 */
export async function uploadToFirebaseSecure(formData: FormData, folder: string = 'uploads') {
    const file = formData.get('file') as File;
    const uploaderUid = await assertUploadAllowed(file, folder);

    const app = await initAdmin();
    if (!app) {
        throw new Error('Firebase Admin initialization failed');
    }

    const bucketName = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').replace(/"/g, '').trim();
    const bucket = bucketName ? app.storage().bucket(bucketName) : app.storage().bucket();
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log(`[Secure Upload] Buffer prepared: ${buffer.length} bytes. Type: ${file.type}`);
        
        const timestamp = Date.now();
        const extension = file.name.split('.').pop() || 'bin';
        const filename = `${uuidv4()}_${timestamp}.${extension}`;
        const destination = `${folder}/${filename}`;

        const fileRef = bucket.file(destination);
        
        console.log(`[Secure Upload] Uploading to Firebase Storage: ${destination}`);
        
        await fileRef.save(buffer, {
            metadata: {
                contentType: file.type || 'application/octet-stream',
                metadata: {
                    originalName: file.name,
                    uploadedBy: folder
                }
            },
            public: false,
        });

        console.log(`[Secure Upload] Success: ${destination}`);
        return destination;

    } catch (error: any) {
        console.error("Firebase Secure Upload Error:", error);
        throw new Error(`Failed to upload file securely: ${error.message}`);
    }
}

/**
 * Saves a base64 slip image directly to Firestore 'slipImages' collection.
 * Avoids using Firebase Storage completely.
 */
export async function saveBase64SlipAction(base64Data: string): Promise<string> {
    // สลิปโอนเงินเป็นข้อมูลส่วนตัว — ต้องล็อกอินและบันทึกว่าใครเป็นคนอัป
    const { uid } = await requireUser();

    if (typeof base64Data !== 'string' || base64Data.length > 8 * 1024 * 1024) {
        throw new Error('Invalid slip data');
    }

    const app = await initAdmin();
    if (!app) {
        throw new Error('Firebase Admin initialization failed');
    }
    const db = app.firestore();

    try {
        const docRef = await db.collection('slipImages').add({
            base64Data,
            uploadedBy: uid,
            createdAt: new Date().toISOString(),
        });
        return `base64_slip_${docRef.id}`;
    } catch (error: any) {
        console.error("Firebase Secure Base64 Save Error:", error);
        throw new Error(`Failed to save slip: ${error.message}`);
    }
}

/**
 * Uploads a file to Firebase Storage publicly.
 * Best for: profile pictures, assets that need to be publicly visible.
 * Returns the public HTTPS URL.
 */
export async function uploadToFirebasePublic(formData: FormData, folder: string = 'public'): Promise<string> {
    const file = formData.get('file') as File;
    await assertUploadAllowed(file, folder);
    if (!file) {
        throw new Error('No file provided');
    }

    const app = await initAdmin();
    if (!app) {
        throw new Error('Firebase Admin initialization failed');
    }

    const bucketName = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').replace(/"/g, '').trim();
    console.log(`[Firebase Public] Using bucket name: "${bucketName}"`);

    const bucket = bucketName ? app.storage().bucket(bucketName) : app.storage().bucket();
    console.log(`[Firebase Public] Resolved bucket: "${bucket.name}"`);
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const timestamp = Date.now();
        const extension = file.name.split('.').pop() || 'png';
        const filename = `${uuidv4()}_${timestamp}.${extension}`;
        const destination = `${folder}/${filename}`;

        const fileRef = bucket.file(destination);
        
        await fileRef.save(buffer, {
            metadata: {
                contentType: file.type || 'image/jpeg',
            },
            public: true,
        });

        // Construct the public URL for Google Cloud Storage
        return `https://storage.googleapis.com/${bucket.name}/${destination}`;
    } catch (error: any) {
        console.error("Firebase Public Upload Error:", error);
        throw new Error(`Failed to upload public file: ${error.message}`);
    }
}
