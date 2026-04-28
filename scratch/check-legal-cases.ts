
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

async function checkLegalCases(targetId: string) {
  console.log(`Checking legalCases for ID: ${targetId}...`);
  const docSnap = await db.collection('legalCases').doc(targetId).get();
  if (docSnap.exists) {
    console.log(`✅ Found in legalCases!`);
    console.log(JSON.stringify(docSnap.data(), null, 2));
  } else {
    console.log("❌ Not found in legalCases.");
  }
}

const targetId = 'Yv5XWWZBsF5LTBUlt2gg';
checkLegalCases(targetId).catch(console.error);
