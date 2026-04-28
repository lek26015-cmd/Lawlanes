const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin (mocking initAdmin)
let serviceAccount;
try {
  serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  if (!serviceAccount.privateKey) throw new Error("No private key");
} catch (e) {
  console.log("Failed to parse env", e);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const chatId = "2e81d82e-c5d2-46a1-9a23-b9b45dfb6b21";
  console.log("Checking chat:", chatId);
  
  const chatRef = db.collection('chats').doc(chatId);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) {
    console.log("Chat not found");
    return;
  }
  
  const chatData = chatSnap.data();
  console.log("Chat data:", {
    amount: chatData.amount,
    installmentsLength: chatData.installments?.length,
    status: chatData.status
  });
  
  const isOfficial = (chatData.amount || 0) > 0 || (chatData.installments && chatData.installments.length > 0);
  console.log("isOfficial:", isOfficial);
  
  if (!isOfficial) {
    console.log("Not official, skipping repair.");
    return;
  }
  
  const invSnap = await db.collection('invoices').where('chatId', '==', chatId).get();
  console.log("Invoices found:", invSnap.size);
  
  if (invSnap.empty) {
    console.log("Would create invoice...");
  } else {
    console.log("Invoice already exists:", invSnap.docs[0].id);
  }
  
  const msgSnap = await chatRef.collection('messages').where('type', '==', 'case_proposal').get();
  console.log("Proposal messages found:", msgSnap.size);
}

run().catch(console.error);
