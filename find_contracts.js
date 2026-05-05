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
    const chats = [
        '4fdf8b73-95ab-4cd2-a278-7bb82577744a',
        '2e81d82e-c5d2-46a1-9a23-b9b45dfb6b21',
        '4bfa67a0-583f-47c0-8cf7-2991efb7a2ee',
        '6e494e91-7988-4035-bce5-f4c3247ec23c',
        'ppBmBwAvzR8DSqST84sU'
    ];
    for (const chatId of chats) {
        const snaps = await db.collection('contracts').where('chatId', '==', chatId).get();
        console.log(`Chat ${chatId} has ${snaps.size} contracts`);
        snaps.forEach(doc => {
            console.log("  Contract:", doc.id, "Fields:", Object.keys(doc.data()).join(', '));
        });
    }
}
run();
