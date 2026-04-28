
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

async function searchByTitle(term: string) {
  console.log(`Searching for term: "${term}" in chats...`);
  
  const snapshot = await db.collection('chats').get();
  
  let found = false;
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.caseTitle?.includes(term) || data.description?.includes(term)) {
      console.log(`✅ Found Match: ID: ${doc.id} | Title: ${data.caseTitle} | Status: ${data.status}`);
      found = true;
    }
  });

  if (!found) console.log("No matches found.");
}

searchByTitle('สัญญา').catch(console.error);
