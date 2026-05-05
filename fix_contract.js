const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({ 
            projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL, 
            privateKey: process.env.FIREBASE_PRIVATE_KEY 
        }),
    });
}
const db = admin.firestore();

async function run() {
    const docId = 'gsIsR5OfrrSU9vPt957N';
    console.log('Fixing doc', docId);
    await db.collection('contracts').doc(docId).delete();
    console.log('Deleted broken contract', docId);
}
run();
