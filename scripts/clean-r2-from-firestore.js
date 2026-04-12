/**
 * Phase 3: Clean ALL R2 URLs from Firestore
 * Replaces R2 URLs with empty strings to prevent broken links.
 * 
 * Run with --dry-run first to see what would be changed.
 * Then run without --dry-run to execute.
 * 
 * Usage:
 *   node scripts/clean-r2-from-firestore.js --dry-run
 *   node scripts/clean-r2-from-firestore.js
 */
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const isDryRun = process.argv.includes('--dry-run');

const params = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
};

if (!params.projectId || !params.clientEmail || !params.privateKey) {
    console.error('Error: Missing environment variables in .env.local');
    process.exit(1);
}

try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: params.projectId.trim(),
            clientEmail: params.clientEmail.trim(),
            privateKey: params.privateKey.replace(/\\n/g, '\n'),
        }),
    });
    console.log('✅ Firebase Admin initialized.');
} catch (error) {
    console.error('Firebase Initialization Error:', error.message);
    process.exit(1);
}

const db = admin.firestore();

const R2_PATTERN = /https:\/\/[^"'\s]*r2\.dev[^"'\s]*/g;

const collections = [
    'chats', 'bookOrders', 'lawyerProfiles', 'users',
    'withdrawals', 'contractRequests', 'registrationRequests',
    'smeRequests', 'contracts', 'compliance_events',
    'tickets', 'invoices', 'transactions', 'notifications'
];

/**
 * Recursively clean R2 URLs from an object
 */
function cleanR2FromObject(obj) {
    if (typeof obj === 'string') {
        if (obj.match(R2_PATTERN)) {
            return ''; // Replace R2 URL with empty string
        }
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => cleanR2FromObject(item));
    }
    if (obj && typeof obj === 'object') {
        // Skip Firestore Timestamps and other special types
        if (obj.constructor && obj.constructor.name !== 'Object') {
            return obj;
        }
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            cleaned[key] = cleanR2FromObject(value);
        }
        return cleaned;
    }
    return obj;
}

async function cleanCollection(collectionName) {
    const snapshot = await db.collection(collectionName).get();
    let updatedCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const jsonStr = JSON.stringify(data);
        
        if (!jsonStr.match(R2_PATTERN)) continue;

        const cleaned = cleanR2FromObject(data);
        
        if (isDryRun) {
            console.log(`  [DRY RUN] Would update ${collectionName}/${doc.id}`);
            // Show which fields changed
            for (const [key, value] of Object.entries(data)) {
                const origStr = JSON.stringify(value);
                const cleanStr = JSON.stringify(cleaned[key]);
                if (origStr !== cleanStr) {
                    console.log(`    Field: ${key}`);
                    console.log(`      Before: ${origStr.substring(0, 100)}...`);
                    console.log(`      After:  ${cleanStr.substring(0, 100)}...`);
                }
            }
        } else {
            await doc.ref.update(cleaned);
        }
        updatedCount++;

        // Also clean subcollections (messages in chats)
        if (collectionName === 'chats') {
            try {
                const messagesSnap = await doc.ref.collection('messages').get();
                for (const msgDoc of messagesSnap.docs) {
                    const msgData = msgDoc.data();
                    const msgJson = JSON.stringify(msgData);
                    if (msgJson.match(R2_PATTERN)) {
                        const cleanedMsg = cleanR2FromObject(msgData);
                        if (isDryRun) {
                            console.log(`  [DRY RUN] Would update ${collectionName}/${doc.id}/messages/${msgDoc.id}`);
                        } else {
                            await msgDoc.ref.update(cleanedMsg);
                        }
                    }
                }
            } catch (e) {
                // subcollection doesn't exist
            }
        }
    }

    return updatedCount;
}

async function main() {
    console.log(`\n🧹 R2 URL Cleanup ${isDryRun ? '(DRY RUN)' : '(LIVE)'}\n`);

    let totalUpdated = 0;
    for (const col of collections) {
        try {
            const count = await cleanCollection(col);
            if (count > 0) {
                console.log(`  📝 ${col}: ${count} documents ${isDryRun ? 'would be' : ''} updated`);
            } else {
                console.log(`  ✅ ${col}: no R2 URLs found`);
            }
            totalUpdated += count;
        } catch (e) {
            console.error(`  ❌ Error cleaning ${col}:`, e.message);
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Total documents ${isDryRun ? 'that would be' : ''} updated: ${totalUpdated}`);
    if (isDryRun) {
        console.log('\n⚠️  This was a DRY RUN. Run without --dry-run to execute.');
    } else {
        console.log('\n✅ All R2 URLs have been cleaned from Firestore.');
    }
}

main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
