
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

async function findInvoiceByChat(chatId: string) {
  console.log(`Searching for invoice for chat: ${chatId}...`);
  
  const snapshot = await db.collection('invoices').where('chatId', '==', chatId).get();
  
  if (snapshot.empty) {
    console.log("No invoice found for this chat.");
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`- Invoice ID: ${doc.id} | Title: ${data.title} | Status: ${data.status}`);
  });
}

findInvoiceByChat('4fdf8b73-95ab-4cd2-a278-7bb82577744a').catch(console.error);
