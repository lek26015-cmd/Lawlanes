const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
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
    console.log('Firebase Admin initialized successfully.');
} catch (error) {
    console.error('Firebase Initialization Error:', error.message);
    process.exit(1);
}

const db = admin.firestore();

const collections = [
    'chats',
    'bookOrders',
    'lawyerProfiles',
    'withdrawals',
    'contractRequests',
    'registrationRequests',
    'smeRequests',
    'contracts',
    'compliance_events',
    'tickets',
    'invoices',
    'transactions'
];

async function scan() {
    console.log('Scanning collections for R2 URLs...');
    const allLeaks = [];

    for (const col of collections) {
        try {
            const snapshot = await db.collection(col).get();
            let count = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                const jsonStr = JSON.stringify(data);
                const r2Matches = jsonStr.match(/https:\/\/[^"'\s]*r2\.dev[^"'\s]*/g);
                if (r2Matches) {
                    r2Matches.forEach(url => {
                        allLeaks.push({ url, col, docId: doc.id });
                        count++;
                    });
                }
            });
            if (count > 0) console.log(`Found ${count} links in ${col}`);
        } catch (e) {
            console.error(`Error scanning ${col}:`, e.message);
        }
    }

    // Unique URLs
    const uniqueLinks = Array.from(new Set(allLeaks.map(l => l.url)));
    
    console.log('\n--- RESULTS START ---');
    uniqueLinks.forEach(url => console.log(url));
    console.log('--- RESULTS END ---');
    console.log(`Total unique leaked URLs: ${uniqueLinks.length}`);
}

scan().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
