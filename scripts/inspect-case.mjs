// inspect-case.mjs — ดูข้อมูล case ระหว่างทนายกับลูกความ
//
// ใช้: node scripts/inspect-case.mjs "<ชื่อทนาย>" "<ชื่อลูกความ>"
// ต้องมี .env.local ที่มี NEXT_PUBLIC_FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// รองรับทั้งคีย์ที่ escape \n มาแล้วและคีย์ที่ขึ้นบรรทัดจริง (ดู scripts/set-admin-claim.js)
function formatPrivateKey(key) {
  return key.trim().replace(/^"|"$/g, '').trim().replace(/\\n/g, '\n').replace(/\\r/g, '\r');
}

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY || '');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ ไม่พบ environment variables ที่จำเป็นใน .env.local:');
  if (!projectId) console.error('   - NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  if (!clientEmail) console.error('   - FIREBASE_CLIENT_EMAIL');
  if (!privateKey) console.error('   - FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});

const db = getFirestore(app);

const [LAWYER_NAME, CLIENT_NAME] = process.argv.slice(2);

if (!LAWYER_NAME || !CLIENT_NAME) {
  console.error('❌ ใช้: node scripts/inspect-case.mjs "<ชื่อทนาย>" "<ชื่อลูกความ>"');
  process.exit(1);
}

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
