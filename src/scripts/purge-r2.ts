import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, ObjectIdentifier } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
} = process.env;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ACCOUNT_ID || !R2_BUCKET_NAME) {
    console.error('❌ Missing R2 credentials in .env.local');
    process.exit(1);
}

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});

const FOLDERS_TO_PURGE = [
    'lawyer-documents/',
    'uploads/',
    'payment-slips/',
    'sme-requests/',
];

async function purgeFolder(prefix: string) {
    console.log(`\n🔍 Searching for objects in: ${prefix}...`);
    
    let deletedCount = 0;
    let continuationToken: string | undefined = undefined;

    do {
        const listCommand = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: prefix,
            ContinuationToken: continuationToken,
        });

        const listResponse = await s3.send(listCommand);
        const objects = listResponse.Contents;

        if (!objects || objects.length === 0) {
            console.log(`✅ No objects found in ${prefix}`);
            break;
        }

        const objectIds: ObjectIdentifier[] = objects
            .map(obj => ({ Key: obj.Key }))
            .filter((obj): obj is ObjectIdentifier => !!obj.Key);

        console.log(`🗑️ Deleting ${objectIds.length} objects...`);
        
        const deleteCommand = new DeleteObjectsCommand({
            Bucket: R2_BUCKET_NAME,
            Delete: {
                Objects: objectIds,
                Quiet: true,
            },
        });

        await s3.send(deleteCommand);
        deletedCount += objectIds.length;
        continuationToken = listResponse.NextContinuationToken;

    } while (continuationToken);

    console.log(`✨ Successfully purged ${deletedCount} objects from ${prefix}`);
}

async function main() {
    console.log('🚀 Starting R2 Security Purge...');
    console.log(`📦 Bucket: ${R2_BUCKET_NAME}`);
    
    for (const folder of FOLDERS_TO_PURGE) {
        try {
            await purgeFolder(folder);
        } catch (error) {
            console.error(`❌ Error purging ${folder}:`, error);
        }
    }
    
    console.log('\n🏁 Purge complete.');
}

main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
