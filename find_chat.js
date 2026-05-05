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
    // let's find the contract gslsR5OfrrSU9vPt957N from our fix_contract.js? No, it's deleted.
    // Let's find recent chats
    const snaps = await db.collection('chats').orderBy('updatedAt', 'desc').limit(5).get();
    snaps.forEach(doc => {
        console.log("CHAT:", doc.id, doc.data().caseTitle);
    });
}
run();
