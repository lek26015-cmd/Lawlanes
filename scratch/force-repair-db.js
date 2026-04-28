const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

let serviceAccount;
try {
  serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
} catch (e) {
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const chatId = "2e81d82e-c5d2-46a1-9a23-b9b45dfb6b21";
  const chatRef = db.collection('chats').doc(chatId);
  const chatSnap = await chatRef.get();
  const chatData = chatSnap.data();
  
  let invoiceId;
  const invSnap = await db.collection('invoices').where('chatId', '==', chatId).get();
  if (invSnap.empty) {
      console.log("Creating invoice...");
      const invoiceRef = await db.collection('invoices').add({
          chatId: chatId,
          clientId: chatData.clientId || chatData.customerId || 'unknown',
          lawyerId: chatData.lawyerId || 'unknown',
          title: `เอกสารใบเสนอราคา (ชุดย้อนหลัง): ${chatData.caseTitle || 'เคส'}`,
          amount: chatData.amount || 0,
          status: chatData.status === 'active' || chatData.status === 'paid' ? 'paid' : 'pending',
          type: 'proposal',
          items: (chatData.installments || []).map((inst) => ({
              description: inst.description,
              amount: parseFloat(String(inst.amount).replace(/,/g, '')),
          })),
          clientInfo: chatData.clientInfo || null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
      });
      invoiceId = invoiceRef.id;
      console.log("Created invoice:", invoiceId);
  } else {
      invoiceId = invSnap.docs[0].id;
      console.log("Found existing invoice:", invoiceId);
  }

  const invoiceLink = `http://localhost:9002/th/invoice/${invoiceId}`;
  const messagesRef = chatRef.collection('messages');
  const msgSnap = await messagesRef.where('type', '==', 'case_proposal').get();
  
  if (!msgSnap.empty) {
      console.log("Updating existing case_proposal message...");
      const oldMsgDoc = msgSnap.docs[0];
      const oldMetadata = oldMsgDoc.data().metadata || {};
      await oldMsgDoc.ref.update({
          metadata: {
              ...oldMetadata,
              invoiceId: invoiceId,
              invoiceLink: invoiceLink
          }
      });
      console.log("Updated message metadata.");
  } else {
      console.log("No case_proposal message found to update.");
  }
}

run().catch(console.error);
