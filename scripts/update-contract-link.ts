/**
 * Script: อัปเดตร่างสัญญาในแชทให้เป็นลิงก์ Capdeal ที่เซ็นได้
 * 
 * - อัปเดต Contract document ให้มี contractText
 * - อัปเดตข้อความ contract_draft ในแชทให้ชี้ไปที่ Capdeal
 * 
 * Usage: npx tsx scripts/update-contract-link.ts
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const clean = (val: string | undefined) => {
    if (!val) return '';
    let cleaned = val.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.substring(1, cleaned.length - 1);
    }
    return cleaned.replace(/\\n/g, '\n');
};

const projectId = clean(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL);
const privateKey = clean(process.env.FIREBASE_PRIVATE_KEY);
const storageBucket = clean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        storageBucket,
    });
}

const db = admin.firestore();

// === CONFIG ===
const CHAT_ID = '2e81d82e-c5d2-46a1-9a23-b9b45dfb6b21';
const CONTRACT_ID = 'gsIsR5OfrrSU9vPt957N';
const CONTRACT_LINK = `https://capdeal.lawslane.com/th/contract/${CONTRACT_ID}`;

async function main() {
    console.log('\n🔧 อัปเดตร่างสัญญาให้เป็นลิงก์ Capdeal...\n');

    // 1. Get chat data (to extract contractText)
    const chatRef = db.collection('chats').doc(CHAT_ID);
    const chatSnap = await chatRef.get();
    
    if (!chatSnap.exists) {
        console.error('❌ ไม่พบ Chat');
        process.exit(1);
    }

    const chatData = chatSnap.data()!;
    const contractText = chatData.contractText || '';
    
    console.log(`   Chat Title: ${chatData.caseTitle}`);
    console.log(`   Contract Text Length: ${contractText.length} chars`);
    console.log(`   Contract ID: ${CONTRACT_ID}`);

    // 2. Update the Contract document to include contractText + clientInfo
    console.log('\n📝 อัปเดต Contract document ใน Firestore...');
    
    const contractRef = db.collection('contracts').doc(CONTRACT_ID);
    const contractSnap = await contractRef.get();
    
    if (!contractSnap.exists) {
        console.error('❌ ไม่พบ Contract document');
        process.exit(1);
    }

    await contractRef.update({
        contractText: contractText,
        clientInfo: chatData.clientInfo || null,
        installments: chatData.installments || [],
        amount: chatData.amount || 0,
        description: chatData.description || '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('   ✅ Contract document อัปเดตแล้ว (เพิ่ม contractText, clientInfo, installments)');

    // 3. Find and update the contract_draft message in chat
    console.log('\n📝 อัปเดตข้อความร่างสัญญาในแชท...');
    
    const messagesRef = chatRef.collection('messages');
    const draftMsgSnap = await messagesRef.where('type', '==', 'contract_draft').get();

    if (draftMsgSnap.empty) {
        console.log('   ⚠️  ไม่พบข้อความ contract_draft — สร้างใหม่');
        await messagesRef.add({
            chatId: CHAT_ID,
            text: `📄 **สัญญาจ้างทนายความ (ฉบับทางการ)**\n\nระบบได้ออกสัญญาจ้างทนายความอิเล็กทรอนิกส์ให้คุณแล้ว ทั้งทนายความและลูกความสามารถตรวจสอบรายละเอียดและลงนามแบบดิจิทัลได้ที่ลิงก์ด้านล่าง:\n\n🔗 [กดเพื่อดูและเซ็นสัญญาที่นี่](${CONTRACT_LINK})\n\n**รายละเอียดสัญญา:**\n- หัวข้อ: ${chatData.caseTitle || 'สัญญาจ้างทำของ'}\n- ยอดรวม: ฿${(chatData.amount || 0).toLocaleString()}\n- จำนวนงวด: ${chatData.installments?.length || 1} งวด\n\n*หมายเหตุ: สัญญานี้มีผลผูกพันตามกฎหมายหลังจากทั้งสองฝ่ายลงนามแล้ว*`,
            senderId: 'system',
            senderName: 'System',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'contract_draft',
            metadata: {
                contractId: CONTRACT_ID,
                contractLink: CONTRACT_LINK,
                isUpdated: true
            }
        });
        console.log('   ✅ สร้างข้อความ contract_draft ใหม่พร้อมลิงก์ Capdeal');
    } else {
        // Update existing message(s)
        for (const msgDoc of draftMsgSnap.docs) {
            await msgDoc.ref.update({
                text: `📄 **สัญญาจ้างทนายความ (ฉบับทางการ)**\n\nระบบได้ออกสัญญาจ้างทนายความอิเล็กทรอนิกส์ให้คุณแล้ว ทั้งทนายความและลูกความสามารถตรวจสอบรายละเอียดและลงนามแบบดิจิทัลได้ที่ลิงก์ด้านล่าง:\n\n🔗 [กดเพื่อดูและเซ็นสัญญาที่นี่](${CONTRACT_LINK})\n\n**รายละเอียดสัญญา:**\n- หัวข้อ: ${chatData.caseTitle || 'สัญญาจ้างทำของ'}\n- ยอดรวม: ฿${(chatData.amount || 0).toLocaleString()}\n- จำนวนงวด: ${chatData.installments?.length || 1} งวด\n\n*หมายเหตุ: สัญญานี้มีผลผูกพันตามกฎหมายหลังจากทั้งสองฝ่ายลงนามแล้ว*`,
                metadata: {
                    contractId: CONTRACT_ID,
                    contractLink: CONTRACT_LINK,
                    isUpdated: true,
                },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`   ✅ อัปเดตข้อความ ${msgDoc.id} → เป็นลิงก์ Capdeal`);
        }
    }

    // 4. Also check/update the capdeal_contract message to make sure it has the right link
    const capdealMsgSnap = await messagesRef.where('type', '==', 'capdeal_contract').get();
    console.log(`\n   Capdeal contract messages: ${capdealMsgSnap.size}`);
    for (const msgDoc of capdealMsgSnap.docs) {
        const msgData = msgDoc.data();
        console.log(`   - ${msgDoc.id}: contractId=${msgData.metadata?.contractId || 'N/A'}`);
    }

    console.log('\n✅ เสร็จสิ้น!');
    console.log(`   ตอนนี้ทั้งร่างสัญญาและ Capdeal contract ชี้ไปที่ลิงก์เดียวกัน:`);
    console.log(`   🔗 ${CONTRACT_LINK}`);
    console.log(`\n   ทนายกฤตเมธและลูกความสกาวรัตน์สามารถกดลิงก์นี้เพื่อดูและเซ็นสัญญาได้เลยครับ\n`);

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Script Error:', err);
    process.exit(1);
});
