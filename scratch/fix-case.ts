
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // Handle newlines in private key
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function fixCase(chatId: string) {
  console.log(`Checking case: ${chatId}...`);
  
  // 1. Check in chats
  const chatSnap = await db.collection('chats').doc(chatId).get();
  if (!chatSnap.exists) {
    console.log(`❌ Chat ${chatId} not found.`);
    
    // Maybe it's an invoice ID already?
    const invSnap = await db.collection('invoices').doc(chatId).get();
    if (invSnap.exists) {
      console.log(`✅ ID is already an invoice ID. Status: ${invSnap.data()?.status}`);
      return;
    }
    
    return;
  }

  const chatData = chatSnap.data();
  console.log(`✅ Found chat: ${chatData?.caseTitle} (${chatData?.status})`);

  // 2. Check for existing invoice
  const invQuery = await db.collection('invoices').where('chatId', '==', chatId).get();
  if (!invQuery.empty) {
    console.log(`✅ Invoice already exists: ${invQuery.docs[0].id}`);
    return;
  }

  console.log(`Creating retroactive invoice for chat ${chatId}...`);

  const invoiceRef = db.collection('invoices').doc();
  const invoiceId = invoiceRef.id;

  const invoicePayload = {
    id: invoiceId,
    chatId: chatId,
    caseId: chatId,
    caseTitle: chatData?.caseTitle || 'สัญญาจ้างทนายความ',
    title: `สัญญาจ้างทนายความ: ${chatData?.caseTitle || 'เคส'}`,
    client_id: chatData?.clientId || chatData?.participants?.find((p: string) => p !== chatData?.lawyerId) || '',
    lawyer_id: chatData?.lawyerId || '',
    amount: chatData?.amount || 0,
    status: 'pending',
    createdAt: new Date(),
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    items: [
      {
        description: `ค่าจ้างว่าความ/ที่ปรึกษากฎหมาย: ${chatData?.caseTitle}`,
        amount: chatData?.amount || 0,
        quantity: 1
      }
    ]
  };

  await invoiceRef.set(invoicePayload);
  console.log(`🚀 Success! New Invoice ID: ${invoiceId}`);
  console.log(`Link: https://capdeal.lawslane.com/th/invoice/${invoiceId}`);
}

const targetId = 'Yv5XWWZBsF5LTBUlt2gg';
fixCase(targetId).catch(console.error);
