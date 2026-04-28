// inspect-case.mjs — ดูข้อมูล case ระหว่างทนายกฤตเมธ กับลูกความสกาวรัตน์
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: cert({
    projectId: 'studio-3946808940-28553',
    clientEmail: 'firebase-adminsdk-fbsvc@studio-3946808940-28553.iam.gserviceaccount.com',
    privateKey: `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC/o/KAQvhXvz7O\nGXO2yg87J4dMSR9X+er70o7ENMsryUTllqVVCcadx2Q0uKVrF5EhPKwsW3/Lg+nG\nb4QeC5fXznGkXX1MYNOEBH/xIosn3U5kD2oUJSO3wGp0HREKJ//afAVCMZhm2MSu\ns2qcDx94KX2oMEwIPFzuJGRbO3qtL3cxsu2kejDAiPHKENYo0aJd1MHqsLV9MHZK\nYo/j5ResQoihx2aEJaZZG12szVwKvYuJ2ZFJdllmcuueibEd/xYTM84bqzk6lHLm\npVFAMsA1EvSOkRaVysHVhYUHvmirBsJt8H5il0qLG4AneNw8k/+nHR4QuosVpZEz\nCpSlTMqXAgMBAAECggEASD7jxFO68MWBxUvWEjJhhJD10h386XsniZDKzpACifrB\n9PWSVZkuXbvV/IQhpFpJlaicVcqWxl/wCSVwPq1rLGnA8NBn1JvqEWpq2zqFEF2/\nWDxxZq/Lo9GvsB9nFZeXvkOj7dzpkdglaaDsz3FqETA/FWFDwJUVCZgBl104dcH3\noV9Y7fStKLq2yjwCfg7EsXcfR7r97WdDq33n1F3vKalfmX4zxzXUi6qPU0SM9UDX\n4mjDVhbO+6vN3Wfl8rvuG1lvS+SQZa8rqXIudb6xO8czKjBmfWt0xntLgICqbFdp\nt+/v4czYtoVh9Z1eTfLH4gCoOe7WFksziF5BOEsWZQKBgQD3Ipw5V46LpeZPweko\nzdl73j+esZlu5WlsQw2K9cnmv8QSl0d8zRGhQZGxidtHO90pRBHL0o+9aGzmjxwU\nrNuxfibssUMM+d7f91rmY1hy+R/UJJhFGOjyGJwKngAOrSjITuP0yQUVrPOtSOoX\nzYHy4tfO4ArRnvF0oglYMatgqwKBgQGg72GDvjoGnnavzIOuP4BY2oIHNjpxCQc+\njenfD4Zkc4bOAJ3gQtRsMg6ssVDgrO8N9mH52r5/qJgNHpRQOGYuN4qM3Hl78mE0\nsxSu01Qs8+k7WabUdqZtRuxZOLyGAgNxsjwK1pamyk/geWdmKl81qUHsg+pq9RON\n9ASKZDg1xQKBgFNZSeURAZNZnWZy2McZPetH1p8X+M5s8vQ/XRbrtG9tZ5x5hvOx\nWevP6Go/O0Q4DWv4eCQM3Mudp3TO+UKD1ghzqn8TfbCnqSJSE0c2ZENKgBCVUwGi\n2BWmdSIjjZNllSaRbNJG5b8cuIZN3B2xAs2+8dfkueFewMJ8T7h97/XHAoGAT88v\nJvJmB4p9awBrM4+W5qISnKukm0Ux8GhFmjQ3p7L6g1+kGUFE/aqyU6OGDI36Hfbs\nNPNImzJAzyV4IzhJfFNAFJmfDcHIatOEgTTdJqV5Iy9L7yc0icJ1yvkQch/lGpS5\npvHW53921Zx5gY2PcZd2tYvjdtTI480y9iCMqLECgYBSnQYDkKFxizGVgLcS2z/7\nrITXeAn6xSq+QkQl/RawFS+m0QES+M1e5oll8xfIMkA8eg+xNgjEgDzioTq8NlSK\nqRW+bpAG9Gomh3KwbZO8Mwp6v5zu98YFIwcG49Hy94L1zqd4FgzR5Bl8E50UM0Sc\ni2t2WeJBhF04OV/gV5YqAg==\n-----END PRIVATE KEY-----\n`,
  }),
});

const db = getFirestore(app);

const LAWYER_NAME = 'กฤตเมธ';
const CLIENT_NAME = 'สกาวรัตน์';

async function main() {
  console.log(`\n🔍 ค้นหาทนาย "${LAWYER_NAME}"...`);
  
  // 1. หา lawyerId จาก lawyerProfiles
  const lawyerSnap = await db.collection('lawyerProfiles')
    .where('name', '>=', LAWYER_NAME)
    .where('name', '<=', LAWYER_NAME + '\uf8ff')
    .limit(5)
    .get();

  if (lawyerSnap.empty) {
    console.log('❌ ไม่พบทนาย — ลอง search แบบกว้างขึ้น...');
    const allLawyers = await db.collection('lawyerProfiles').get();
    allLawyers.docs.forEach(d => {
      if (d.data().name?.includes('กฤต')) {
        console.log(`  พบ: ${d.data().name} (id: ${d.id})`);
      }
    });
    return;
  }

  const lawyerDoc = lawyerSnap.docs[0];
  const lawyerId = lawyerDoc.id;
  const lawyerData = lawyerDoc.data();
  console.log(`✅ พบทนาย: ${lawyerData.name} (lawyerId: ${lawyerId}, userId: ${lawyerData.userId || 'N/A'})`);

  // 2. หา clientId จาก users
  console.log(`\n🔍 ค้นหาลูกความ "${CLIENT_NAME}"...`);
  const clientSnap = await db.collection('users')
    .where('name', '>=', CLIENT_NAME)
    .where('name', '<=', CLIENT_NAME + '\uf8ff')
    .limit(5)
    .get();

  let clientId = null;
  if (!clientSnap.empty) {
    const clientDoc = clientSnap.docs[0];
    clientId = clientDoc.id;
    console.log(`✅ พบลูกความ: ${clientDoc.data().name} (uid: ${clientId})`);
  } else {
    console.log(`❌ ไม่พบลูกความ "${CLIENT_NAME}" ใน users — ลอง search แบบกว้าง...`);
    const allUsers = await db.collection('users').limit(200).get();
    allUsers.docs.forEach(d => {
      if (d.data().name?.includes('สกาว')) {
        console.log(`  พบ: ${d.data().name} (uid: ${d.id})`);
        clientId = d.id;
      }
    });
  }

  // 3. หา chat document ระหว่างทนายกับลูกความนี้
  console.log(`\n🔍 ค้นหา chat ระหว่างทั้งสองฝ่าย...`);
  const lawyerUserIds = [lawyerId, lawyerData.userId].filter(Boolean);
  
  let chatDocs = [];
  for (const lid of lawyerUserIds) {
    const chatsSnap = await db.collection('chats')
      .where('participants', 'array-contains', lid)
      .orderBy('lastMessageAt', 'desc')
      .limit(20)
      .get();
    
    chatsSnap.docs.forEach(d => {
      const data = d.data();
      const participants = data.participants || [];
      const isRelevant = clientId 
        ? participants.includes(clientId) || data.clientId === clientId || data.userId === clientId
        : true;
      
      if (isRelevant && !chatDocs.find(c => c.id === d.id)) {
        chatDocs.push(d);
      }
    });
  }

  if (chatDocs.length === 0) {
    console.log('❌ ไม่พบ chat ระหว่างทั้งสองฝ่าย');
    
    // Try searching by lawyerId field
    console.log('\nลองค้นหาจาก lawyerId field...');
    for (const lid of lawyerUserIds) {
      const altSnap = await db.collection('chats')
        .where('lawyerId', '==', lid)
        .orderBy('lastMessageAt', 'desc')
        .limit(10)
        .get();
      
      altSnap.docs.forEach(d => {
        console.log(`  chat ${d.id}: ${d.data().caseTitle} | status: ${d.data().status} | client: ${d.data().clientId || d.data().userId}`);
      });
    }
    return;
  }

  console.log(`✅ พบ ${chatDocs.length} chat(s)\n`);

  for (const chatDoc of chatDocs) {
    const chat = chatDoc.data();
    console.log('━'.repeat(60));
    console.log(`📁 Chat ID: ${chatDoc.id}`);
    console.log(`   หัวข้อ: ${chat.caseTitle || chat.title || '-'}`);
    console.log(`   สถานะ: ${chat.status}`);
    console.log(`   ยอดรวม: ฿${(chat.amount || 0).toLocaleString()}`);
    console.log(`   lawyerId: ${chat.lawyerId}`);
    console.log(`   clientId: ${chat.clientId || chat.userId}`);
    console.log(`   isManualCase: ${chat.isManualCase}`);
    console.log(`   paidInstallments: ${chat.paidInstallments || 0} / ${(chat.installments || []).length}`);
    console.log(`   totalPaid: ฿${(chat.totalPaid || 0).toLocaleString()}`);
    console.log(`   hasNewPayment: ${chat.hasNewPayment}`);
    if (chat.installments?.length) {
      console.log(`   งวดชำระเงิน:`);
      chat.installments.forEach((inst, i) => {
        console.log(`     งวด ${i+1}: ฿${inst.amount} — ${inst.status} ${inst.paidAt ? `(จ่ายเมื่อ ${inst.paidAt})` : ''}`);
      });
    }
    console.log(`   lastMessage: ${chat.lastMessage}`);
    const lastAt = chat.lastMessageAt?.toDate?.();
    console.log(`   lastMessageAt: ${lastAt ? lastAt.toLocaleString('th-TH') : '-'}`);
    
    // 4. ดู messages ล่าสุดในห้องแชท
    console.log(`\n   📨 Messages ล่าสุด (10 รายการ):`);
    const msgSnap = await db.collection('chats').doc(chatDoc.id)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    msgSnap.docs.reverse().forEach(m => {
      const msg = m.data();
      const ts = msg.timestamp?.toDate?.();
      const timeStr = ts ? ts.toLocaleString('th-TH') : '-';
      const sender = msg.senderId === 'system' ? '[ระบบ]' : `[${msg.senderName || msg.senderId?.substring(0,8)}]`;
      const preview = (msg.text || '').substring(0, 80).replace(/\n/g, ' ');
      console.log(`     ${timeStr} ${sender} type:${msg.type || 'text'} — ${preview}`);
    });

    // 5. ดู contracts ที่เชื่อมกับ chat นี้
    console.log(`\n   📄 Contracts:`);
    const contractSnap = await db.collection('contracts')
      .where('chatId', '==', chatDoc.id)
      .get();
    
    if (contractSnap.empty) {
      console.log(`     ❌ ไม่มี contract doc ใน collection 'contracts'`);
    } else {
      contractSnap.docs.forEach(c => {
        const cd = c.data();
        const createdAt = cd.createdAt?.toDate?.();
        console.log(`     ✅ Contract ${c.id}: status=${cd.status} | title=${cd.title} | createdAt=${createdAt?.toLocaleString('th-TH') || '-'}`);
      });
    }

    // 6. ดู invoices
    console.log(`\n   🧾 Invoices:`);
    const invSnap = await db.collection('invoices')
      .where('chatId', '==', chatDoc.id)
      .get();
    
    if (invSnap.empty) {
      console.log(`     ❌ ไม่มี invoice`);
    } else {
      invSnap.docs.forEach(inv => {
        const id = inv.data();
        console.log(`     ✅ Invoice ${inv.id}: status=${id.status} | amount=฿${id.amount}`);
      });
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log('✅ ตรวจสอบเสร็จแล้ว');
}

main().catch(console.error).finally(() => process.exit(0));
