/**
 * Phase 1: Scan Firestore for ALL R2 URLs
 * Reports Collection, DocID, Field, and URL for each match.
 * Also outputs a deduplicated list suitable for GSC removal.
 */
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

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

async function deepScanSubcollections(docRef, parentPath, results) {
    // Scan 'messages' subcollection (common in chats)
    try {
        const messagesSnap = await docRef.collection('messages').get();
        messagesSnap.forEach(msgDoc => {
            const jsonStr = JSON.stringify(msgDoc.data());
            const matches = jsonStr.match(R2_PATTERN);
            if (matches) {
                matches.forEach(url => {
                    results.push({
                        url,
                        path: `${parentPath}/messages/${msgDoc.id}`,
                    });
                });
            }
        });
    } catch (e) {
        // subcollection doesn't exist, skip
    }
}

async function scan() {
    console.log('🔍 Scanning ALL collections for R2 URLs...\n');
    const allResults = [];

    for (const col of collections) {
        try {
            const snapshot = await db.collection(col).get();
            let count = 0;
            for (const doc of snapshot.docs) {
                const data = doc.data();
                const jsonStr = JSON.stringify(data);
                const matches = jsonStr.match(R2_PATTERN);
                if (matches) {
                    matches.forEach(url => {
                        allResults.push({
                            url,
                            path: `${col}/${doc.id}`,
                        });
                        count++;
                    });
                }

                // Deep scan subcollections for chats
                if (col === 'chats') {
                    await deepScanSubcollections(doc.ref, `${col}/${doc.id}`, allResults);
                }
            }
            if (count > 0) {
                console.log(`  📄 ${col}: ${count} R2 URLs found`);
            } else {
                console.log(`  ✅ ${col}: clean`);
            }
        } catch (e) {
            console.error(`  ❌ Error scanning ${col}:`, e.message);
        }
    }

    // Deduplicate URLs
    const uniqueUrls = Array.from(new Set(allResults.map(r => r.url)));

    console.log('\n' + '='.repeat(60));
    console.log(`TOTAL MATCHES: ${allResults.length}`);
    console.log(`UNIQUE URLs: ${uniqueUrls.length}`);
    console.log('='.repeat(60));

    // Print detailed results
    console.log('\n--- DETAILED RESULTS ---');
    allResults.forEach(r => {
        console.log(`\n  URL:  ${r.url}`);
        console.log(`  PATH: ${r.path}`);
    });

    // Write GSC removal list
    const gscFile = path.join(__dirname, 'gsc-removal-urls.txt');
    fs.writeFileSync(gscFile, uniqueUrls.join('\n'), 'utf-8');
    console.log(`\n📝 GSC removal list written to: ${gscFile}`);
    console.log(`   (${uniqueUrls.length} unique URLs)`);

    return { allResults, uniqueUrls };
}

scan().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
