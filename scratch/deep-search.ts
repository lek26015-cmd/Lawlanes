
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

async function deepSearch(targetId: string) {
  console.log(`Deep searching for ID: ${targetId}...`);
  
  const collections = ['chats', 'invoices', 'contracts', 'lawyerProfiles', 'users', 'appointments', 'tickets', 'legalForms', 'ads', 'articles', 'case_proposals'];
  
  for (const collName of collections) {
    try {
      const docSnap = await db.collection(collName).doc(targetId).get();
      if (docSnap.exists) {
        console.log(`✅ Found in collection [${collName}] as Document ID!`);
        console.log(JSON.stringify(docSnap.data(), null, 2));
        return;
      }

      // Search common fields
      const fields = ['chatId', 'caseId', 'case_id', 'chat_id', 'invoiceId', 'userId', 'lawyerId'];
      for (const field of fields) {
        const querySnap = await db.collection(collName).where(field, '==', targetId).limit(1).get();
        if (!querySnap.empty) {
          console.log(`✅ Found in collection [${collName}] where field [${field}] matches!`);
          console.log(`Document ID: ${querySnap.docs[0].id}`);
          console.log(JSON.stringify(querySnap.docs[0].data(), null, 2));
          return;
        }
      }
    } catch (e) {
      // console.error(`Error searching ${collName}:`, e.message);
    }
  }
  
  console.log(`❌ ID ${targetId} not found in any common collections or fields.`);
}

const targetId = 'Yv5XWWZBsF5LTBUlt2gg';
deepSearch(targetId).catch(console.error);
