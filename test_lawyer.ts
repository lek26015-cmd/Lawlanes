require('dotenv').config({path: '.env.local'});
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
        })
    });
}
const db = admin.firestore();

async function test() {
    const id = "wS9w7ysNYUajNsBYZ6C7n2Afe9H3";
    const doc = await db.collection('lawyerProfiles').doc(id).get();
    console.log("lawyerProfiles:", doc.exists ? doc.data() : "NOT FOUND");
    
    const userDoc = await db.collection('users').doc(id).get();
    console.log("users:", userDoc.exists ? userDoc.data() : "NOT FOUND");
}

test().catch(console.error).then(() => process.exit(0));
