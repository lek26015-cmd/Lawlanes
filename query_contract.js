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
    const snaps = await db.collection('contracts').orderBy('createdAt', 'desc').limit(1).get();
    if (!snaps.empty) {
        console.log("LATEST CONTRACT:");
        console.log(snaps.docs[0].id, snaps.docs[0].data());
    }
}
run();
