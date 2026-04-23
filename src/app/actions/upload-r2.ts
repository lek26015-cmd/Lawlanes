'use server';

import { r2 } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

/**
 * Uploads a file to Cloudflare R2 Storage.
 * This is the preferred method for documents and non-image files.
 */
export async function uploadToR2(formData: FormData, folder: string = 'uploads') {
    const file = formData.get('file') as File;
    if (!file) {
        throw new Error('No file provided');
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const timestamp = Date.now();
        const extension = file.name.split('.').pop() || 'bin';
        const filename = `${uuidv4()}_${timestamp}.${extension}`;
        const key = `${folder}/${filename}`;

        console.log(`[R2 Upload] Preparing upload: ${key} (${buffer.length} bytes)`);

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
