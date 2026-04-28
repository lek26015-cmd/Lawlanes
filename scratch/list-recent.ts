
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

async function listRecentChats() {
  console.log(`Listing 5 most recent chats in project ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}...`);
  
  const snapshot = await db.collection('chats').orderBy('createdAt', 'desc').limit(5).get();
  
  if (snapshot.empty) {
    console.log("No chats found.");
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id} | Title: ${data.caseTitle} | Status: ${data.status} | Created: ${data.createdAt?.toDate()}`);
  });
}

listRecentChats().catch(console.error);
