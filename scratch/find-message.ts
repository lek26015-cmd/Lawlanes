
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function findMessage(messageId: string) {
  console.log(`Searching for message with ID: ${messageId} across all chats...`);
  
  try {
    const snapshot = await db.collectionGroup('messages').get();
    
    let found = false;
    snapshot.forEach(doc => {
      if (doc.id === messageId) {
        console.log(`✅ Found Message!`);
        console.log(`Path: ${doc.ref.path}`);
        console.log(JSON.stringify(doc.data(), null, 2));
        found = true;
      }
    });

    if (!found) console.log("No message found with this ID.");
  } catch (e) {
    console.error("Error searching messages:", e);
  }
}

const targetId = 'Yv5XWWZBsF5LTBUlt2gg';
findMessage(targetId).catch(console.error);
