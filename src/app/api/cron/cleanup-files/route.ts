import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';
import { r2 } from '@/lib/r2';
import { ListObjectsV2Command, DeleteObjectsCommand, ObjectIdentifier } from '@aws-sdk/client-s3';

// Helper function to extract last 24h cutoff
const getPardonThreshold = () => {
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return d;
};

export async function GET(request: Request) {
    // 1. CRON_SECRET Verification
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (process.env.NODE_ENV === 'production' && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Safety: dryRun query parameter (default acts as dry run unless ?execute=true)
    const { searchParams } = new URL(request.url);
    const isDryRun = searchParams.get('execute') !== 'true';

    try {
        const adminApp = await initAdmin();
        if (!adminApp) throw new Error("Firebase Admin not initialized");
        const db = adminApp.firestore();

        console.log(`[Cron] Starting global file scan... (DryRun: ${isDryRun})`);

        // 2. Build Set of Active URLs from Firestore
        const activeUrls = new Set<string>();

        // Scan Chats
        const chatsSnap = await db.collection('chats').get();
        chatsSnap.forEach((doc) => {
            const data = doc.data();
            if (data.files && Array.isArray(data.files)) {
                data.files.forEach((file: any) => {
                    if (file.url) activeUrls.add(file.url);
                    if (file.fullPath) activeUrls.add(file.fullPath);
                });
            }
            if (data.pendingPaymentDetails?.slipUrl) {
                activeUrls.add(data.pendingPaymentDetails.slipUrl);
            }
        });

        // Scan Users
        const usersSnap = await db.collection('users').get();
        usersSnap.forEach((doc) => {
            const data = doc.data();
            if (data.avatar) activeUrls.add(data.avatar);
            if (data.imageUrl) activeUrls.add(data.imageUrl);
        });

        // Scan Lawyers
        const lawyersSnap = await db.collection('lawyers').get();
        lawyersSnap.forEach((doc) => {
            const data = doc.data();
            if (data.avatar) activeUrls.add(data.avatar);
            if (data.imageUrl) activeUrls.add(data.imageUrl);
            // Scan credentials or other attachments
            if (data.credentialFiles && Array.isArray(data.credentialFiles)) {
                data.credentialFiles.forEach((fileUrl: string) => activeUrls.add(fileUrl));
            }
        });

        const pardonThreshold = getPardonThreshold();
        let totalR2Orphans = 0;
        let totalFbOrphans = 0;

        // 3. Scan Cloudflare R2
        const r2Bucket = process.env.R2_BUCKET_NAME;
        const r2Orphans: ObjectIdentifier[] = [];

        if (r2Bucket) {
            let continuationToken: string | undefined = undefined;
            do {
                const listRes: any = await r2.send(new ListObjectsV2Command({
                    Bucket: r2Bucket,
                    ContinuationToken: continuationToken
                }));

                const objects = listRes.Contents || [];
                objects.forEach((obj: any) => {
                    if (!obj.Key || !obj.LastModified) return;

                    // Skip recently modified files (within 24h) to avoid deleting in-progress uploads
                    if (obj.LastModified > pardonThreshold) return;

                    // Check if this file exists in any active URL string
                    // S3 objects are just keys, URLs are full domains ending in the key.
                    // e.g. URL: https://pub-xxx.r2.dev/uploads/123/file.png
                    // Key: uploads/123/file.png
                    const isReferenceFound = Array.from(activeUrls).some(url => url.includes(obj.Key as string));
                    
                    if (!isReferenceFound) {
                        r2Orphans.push({ Key: obj.Key });
                    }
                });

                continuationToken = listRes.NextContinuationToken;
            } while (continuationToken);

            totalR2Orphans = r2Orphans.length;

            if (!isDryRun && r2Orphans.length > 0) {
                // DeleteObjectsCommand limits to 1000 items per request
                const chunkSize = 1000;
                for (let i = 0; i < r2Orphans.length; i += chunkSize) {
                    const chunk = r2Orphans.slice(i, i + chunkSize);
                    await r2.send(new DeleteObjectsCommand({
                        Bucket: r2Bucket,
                        Delete: { Objects: chunk, Quiet: true }
                    }));
                }
            }
        }

        // 4. Scan Firebase Storage (if used)
        let fbDeletedKeys: string[] = [];
        try {
            const fbBucket = adminApp.storage().bucket();
            const [files] = await fbBucket.getFiles();

            // Firebase gives full path, but it might be encoded in URLs
            // Public URL usually contains the encoded path or token
            for (const file of files) {
                const metadata = file.metadata;
                const fileDate = new Date(metadata.timeCreated || metadata.updated || Date.now());

                // Skip newly uploaded files
                if (fileDate > pardonThreshold) continue;

                const fileKey = file.name;
                
                // Encode the Firebase key exactly how it appears in client-side URLs
                const encodedKey = encodeURIComponent(fileKey);
                
                // Active URLs in Firebase usually contain the encoded path
                const isReferenceFound = Array.from(activeUrls).some(url => url.includes(encodedKey) || url.includes(fileKey));

                if (!isReferenceFound) {
                    totalFbOrphans++;
                    if (!isDryRun) {
                        await file.delete();
                        fbDeletedKeys.push(fileKey);
                    }
                }
            }
        } catch (fbErr: any) {
            console.warn("[Cron] Firebase Storage cleanup skipped or failed:", fbErr.message);
        }

        return NextResponse.json({
            success: true,
            dryRun: isDryRun,
            message: isDryRun ? "Dry run completed. Append ?execute=true to perform deletion." : "Orphan files deleted successfully.",
            stats: {
                activeReferencesFound: activeUrls.size,
                orphanedR2FilesDetected: totalR2Orphans,
                orphanedFirebaseFilesDetected: totalFbOrphans,
            }
        });

    } catch (error: any) {
        console.error('[Cron] Cleanup failure:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
