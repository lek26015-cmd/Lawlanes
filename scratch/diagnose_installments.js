const admin = require('firebase-admin');

// Using the service account key if it exists, otherwise assuming it's in the environment
try {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  // If no key file, try to initialize with default app if possible (though unlikely to work here)
  if (!admin.apps.length) {
    admin.initializeApp();
  }
}

const db = admin.firestore();
const chatId = '2e81d82e-c5d2-46a1-9a23-b9b45dfb6b21';

async function diagnose() {
  const chatDoc = await db.collection('chats').doc(chatId).get();
  const data = chatDoc.data();
  console.log('Chat status:', data.status);
  console.log('Installments status:');
  data.installments.forEach((inst, i) => {
    console.log(` - งวดที่ ${i+1}: status="${inst.status}" amount=${inst.amount}`);
  });
  console.log('hasNewPayment:', data.hasNewPayment);
}

diagnose();
