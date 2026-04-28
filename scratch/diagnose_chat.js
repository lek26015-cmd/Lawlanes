const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const chatId = '2e81d82e-c5d2-46a1-9a23-b9b45dfb6b21';

async function diagnose() {
  console.log('--- Diagnosis for Chat:', chatId, '---');
  
  const chatDoc = await db.collection('chats').doc(chatId).get();
  if (!chatDoc.exists) {
    console.log('Chat doc NOT found');
    return;
  }
  const chatData = chatDoc.data();
  console.log('Chat Status:', chatData.status);
  console.log('Chat Amount:', chatData.amount);
  console.log('Installments:', chatData.installments?.length || 0);
  
  const invSnap = await db.collection('invoices').where('chatId', '==', chatId).get();
  console.log('Invoices Found:', invSnap.size);
  invSnap.forEach(doc => console.log(' - Inv:', doc.id, doc.data().status, doc.data().amount));
  
  const conSnap = await db.collection('contracts').where('chatId', '==', chatId).get();
  console.log('Contracts Found:', conSnap.size);
  conSnap.forEach(doc => console.log(' - Con:', doc.id, doc.data().status));
  
  const milSnap = await db.collection('milestones').where('case_id', '==', chatId).get();
  console.log('Milestones Found:', milSnap.size);
  milSnap.forEach(doc => console.log(' - Mil:', doc.data().title, doc.data().status, doc.data().order));
}

diagnose();
