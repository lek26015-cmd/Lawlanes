'use server';

import { initAdmin } from '@/lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';

/**
 * Uploads a file to Firebase Storage securely.
 * This should be used for sensitive documents like ID cards and licenses.
 * 
 * @param formData The form data containing the 'file' field
 * @param folder The destination folder in the storage bucket
 * @returns The storage path (not a public URL)
 */
export async function uploadToFirebaseSecure(formData: FormData, folder: string = 'uploads') {
    const file = formData.get('file') as File;
    if (!file) {
        throw new Error('No file provided');
    }

    const app = await initAdmin();
    if (!app) {
        throw new Error('Firebase Admin initialization failed');
    }

    const bucketName = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').replace(/"/g, '').trim();
    if (!bucketName) {
        console.error("Missing storage bucket configuration");
        throw new Error('Storage bucket not configured. Please check environment variables.');
    }

    const bucket = getStorage(app).bucket(bucketName);
    
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
