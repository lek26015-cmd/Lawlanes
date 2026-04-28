/**
 * Script: ค้นหาเคสของทนายกฤตเมธ กับ สกาวรัตน์ แล้วซ่อมเอกสารย้อนหลัง
 * 
 * ขั้นตอน:
 * 1. ค้นหา Lawyer Profile ของ "กฤตเมธ"
 * 2. ค้นหา chats ที่ทนายนี้เป็น participant
 * 3. หาเคสที่ลูกความชื่อ "สกาวรัตน์"
 * 4. ตรวจสอบว่ามี Invoice, Contract, System Messages หรือยัง
 * 5. ถ้ายังไม่มี → สร้างเอกสารย้อนหลังให้
 * 
 * Usage: npx tsx scripts/repair-case-docs.ts
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const clean = (val: string | undefined) => {
    if (!val) return '';
    let cleaned = val.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.substring(1, cleaned.length - 1);
    }
    return cleaned.replace(/\\n/g, '\n');
};

// Initialize Firebase Admin
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

async function main() {
    console.log('\n🔍 ค้นหาทนาย "กฤตเมธ"...\n');

    // 1. Find lawyer profile
    const lawyerSnap = await db.collection('lawyerProfiles').get();
    let lawyerProfile: any = null;

    for (const doc of lawyerSnap.docs) {
        const data = doc.data();
        if (data.name && data.name.includes('กฤตเมธ')) {
            lawyerProfile = { id: doc.id, ...data };
            break;
        }
    }

    if (!lawyerProfile) {
        console.error('❌ ไม่พบทนาย "กฤตเมธ" ในระบบ');
        // Show all lawyer names for debugging
        console.log('\n📋 รายชื่อทนายทั้งหมดในระบบ:');
        for (const doc of lawyerSnap.docs) {
            const data = doc.data();
            console.log(`  - ${data.name || 'N/A'} (ID: ${doc.id}, userId: ${data.userId || 'N/A'})`);
        }
        process.exit(1);
    }

    const lawyerUserId = lawyerProfile.userId || lawyerProfile.id;
    console.log(`✅ พบทนาย: ${lawyerProfile.name}`);
    console.log(`   Profile ID: ${lawyerProfile.id}`);
    console.log(`   User ID: ${lawyerUserId}`);

    // 2. Find chats with this lawyer
    console.log('\n🔍 ค้นหาเคสที่มีลูกความ "สกาวรัตน์"...\n');

    const chatsSnap = await db.collection('chats')
        .where('participants', 'array-contains', lawyerUserId)
        .get();

    console.log(`   พบ ${chatsSnap.size} เคสของทนายคนนี้`);

    let targetChat: any = null;
    let targetChatId: string = '';

    for (const chatDoc of chatsSnap.docs) {
        const chatData = chatDoc.data();
        const clientId = chatData.clientId || chatData.userId || 
            chatData.participants?.find((p: string) => p !== lawyerUserId);
        
        if (!clientId) continue;

        // Check client name
        const userDoc = await db.collection('users').doc(clientId).get();
        const userName = userDoc.exists ? userDoc.data()?.name : 'Unknown';

        console.log(`   📄 Chat ${chatDoc.id}: client="${userName}" status=${chatData.status} amount=฿${chatData.amount || 0}`);

        if (userName && userName.includes('สกาวรัตน์')) {
            targetChat = { id: chatDoc.id, ...chatData };
            targetChatId = chatDoc.id;
            console.log(`   ✅ ตรงกัน!`);
        }
    }

    if (!targetChat) {
        console.error('\n❌ ไม่พบเคสที่มีลูกความ "สกาวรัตน์"');
        process.exit(1);
    }

    console.log(`\n📋 ข้อมูลเคส:`);
    console.log(`   Chat ID: ${targetChatId}`);
    console.log(`   Title: ${targetChat.caseTitle || 'N/A'}`);
    console.log(`   Status: ${targetChat.status}`);
    console.log(`   Amount: ฿${(targetChat.amount || 0).toLocaleString()}`);
    console.log(`   Has Installments: ${targetChat.installments?.length || 0} งวด`);
    console.log(`   Paid At: ${targetChat.paidAt || 'N/A'}`);
    console.log(`   SlipUrl: ${targetChat.slipUrl || targetChat.pendingPaymentDetails?.slipUrl || 'N/A'}`);

    // 3. Check existing documents
    console.log('\n🔍 ตรวจสอบเอกสารที่มีอยู่...\n');

    // Check invoices
    const invSnap = await db.collection('invoices').where('chatId', '==', targetChatId).get();
    console.log(`   Invoices: ${invSnap.size} รายการ`);
    invSnap.docs.forEach(d => {
        const inv = d.data();
        console.log(`     - ${d.id}: ${inv.title} | status=${inv.status} | ฿${inv.amount}`);
    });

    // Check contracts
    const contractSnap = await db.collection('contracts').where('chatId', '==', targetChatId).get();
    console.log(`   Contracts: ${contractSnap.size} รายการ`);
    contractSnap.docs.forEach(d => {
        const c = d.data();
        console.log(`     - ${d.id}: ${c.title || 'Contract'} | status=${c.status}`);
    });

    // Check system messages
    const msgSnap = await db.collection('chats').doc(targetChatId).collection('messages')
        .where('senderId', '==', 'system').get();
    console.log(`   System Messages: ${msgSnap.size} ข้อความ`);
    msgSnap.docs.forEach(d => {
        const m = d.data();
        console.log(`     - type=${m.type || 'N/A'}: ${(m.text || '').substring(0, 80)}...`);
    });

    // 4. Repair if needed
    console.log('\n🔧 เริ่มซ่อมเอกสาร...\n');

    const clientId = targetChat.clientId || targetChat.userId || 
        targetChat.participants?.find((p: string) => p !== lawyerUserId);

    // === CREATE INVOICE if missing ===
    if (invSnap.empty && targetChat.amount > 0) {
        console.log('   📝 สร้าง Invoice ย้อนหลัง...');
        const invoiceRef = db.collection('invoices').doc();
        const invoiceId = invoiceRef.id;

        await invoiceRef.set({
            chatId: targetChatId,
            userId: clientId || 'unknown',
            lawyerId: lawyerProfile.id,
            title: `สัญญาจ้างทนายความ: ${targetChat.caseTitle || 'เคส'}`,
            amount: targetChat.amount || 0,
            status: (targetChat.status === 'active' || targetChat.status === 'paid') ? 'paid' : 'pending',
            type: 'proposal',
            items: (targetChat.installments || []).map((inst: any) => ({
                description: inst.description,
                amount: parseFloat(String(inst.amount).replace(/,/g, '')),
            })),
            clientInfo: targetChat.clientInfo || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`   ✅ Invoice created: ${invoiceId}`);

        // Post invoice link to chat
        const invoiceLink = `https://capdeal.lawslane.com/th/invoice/${encodeURIComponent(invoiceId)}`;
        const existingProposalMsg = msgSnap.docs.find(d => d.data().type === 'case_proposal');
        
        if (!existingProposalMsg) {
            const messagesRef = db.collection('chats').doc(targetChatId).collection('messages');
            await messagesRef.add({
                chatId: targetChatId,
                text: `📄 **เอกสารใบเสนอราคาและใบแจ้งหนี้ (ฉบับสมบูรณ์)**\n\n**หัวข้อ:** ${targetChat.caseTitle || 'เคส'}\n**ยอดเงินรวม:** ฿${(targetChat.amount || 0).toLocaleString()}\n\nคุณสามารถตรวจสอบรายละเอียดเอกสารและดาวน์โหลด PDF ได้ที่ลิงก์ด้านล่างนี้:\n\n🔗 [ดูเอกสารที่นี่](${invoiceLink})`,
                senderId: 'system',
                senderName: 'System',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'case_proposal',
                metadata: {
                    caseTitle: targetChat.caseTitle,
                    amount: targetChat.amount,
                    invoiceId: invoiceId,
                    invoiceLink: invoiceLink,
                    isRepaired: true
                }
            });
            console.log('   ✅ Invoice link posted to chat');
        }
    } else if (!invSnap.empty) {
        console.log('   ℹ️  Invoice มีอยู่แล้ว — ข้ามขั้นตอนนี้');
    }

    // === CREATE CONTRACT if missing (and case is paid/active) ===
    if (contractSnap.empty && (targetChat.status === 'active' || targetChat.status === 'paid' || targetChat.paidAt)) {
        console.log('   📝 สร้าง Contract ย้อนหลัง...');
        const contractRef = db.collection('contracts').doc();
        const contractId = contractRef.id;

        await contractRef.set({
            userId: clientId || 'unknown',
            lawyerId: lawyerUserId,
            chatId: targetChatId,
            title: targetChat.caseTitle || 'สัญญาจ้างทำของ',
            task: targetChat.caseTitle || targetChat.description || 'การดำเนินคดีทางกฎหมาย',
            price: targetChat.amount || 0,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`   ✅ Contract created: ${contractId}`);

        // Post contract link to chat
        const contractLink = `https://capdeal.lawslane.com/th/contract/${contractId}`;
        const existingContractMsg = msgSnap.docs.find(d => d.data().type === 'capdeal_contract');

        if (!existingContractMsg) {
            const messagesRef = db.collection('chats').doc(targetChatId).collection('messages');
            await messagesRef.add({
                chatId: targetChatId,
                text: `📄 **เอกสารจากแคปดีล**\n\nระบบได้ออกสัญญาจ้างทนายความอิเล็กทรอนิกส์ให้คุณแล้ว กรุณากดลิงก์ด้านล่างเพื่อตรวจสอบและลงนามแบบดิจิทัล:\n\n🔗 [กดเพื่อเซ็นสัญญาที่นี่](${contractLink})\n\n*หมายเหตุ: สัญญานี้มีผลผูกพันตามกฎหมายหลังจากทั้งสองฝ่ายลงนามแล้ว*`,
                senderId: 'system',
                senderName: 'System',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'capdeal_contract',
                metadata: {
                    contractId,
                    contractLink,
                    isRepaired: true
                }
            });
            console.log('   ✅ Contract link posted to chat');
        }
    } else if (!contractSnap.empty) {
        console.log('   ℹ️  Contract มีอยู่แล้ว — ข้ามขั้นตอนนี้');
    }

    // === ENSURE PAYMENT LINK MESSAGE ===
    const existingPaymentMsg = msgSnap.docs.find(d => d.data().type === 'payment_instruction');
    if (!existingPaymentMsg && targetChat.amount > 0) {
        console.log('   📝 สร้างข้อความลิงก์ชำระเงิน...');
        const paymentLink = `https://lawslane.com/payment?chatId=${targetChatId}&type=case`;
        const messagesRef = db.collection('chats').doc(targetChatId).collection('messages');
        await messagesRef.add({
            chatId: targetChatId,
            text: `💳 **ช่องทางการชำระเงิน**\n\nคุณสามารถชำระเงินผ่านระบบ Thai QR Payment หรือบัตรเครดิตได้โดยตรงที่ลิงก์ด้านล่างนี้:\n\n🔗 [ชำระเงินที่นี่](${paymentLink})\n\n*เงินของคุณจะถูกเก็บไว้ในระบบ Escrow ของ Lawslane*`,
            senderId: 'system',
            senderName: 'System',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'payment_instruction',
            metadata: { isRepaired: true }
        });
        console.log('   ✅ Payment instruction posted to chat');
    }

    // === ENSURE CONTRACT TEXT MESSAGE if contractText exists ===
    if (targetChat.contractText) {
        const existingContractTextMsg = msgSnap.docs.find(d => d.data().type === 'contract_draft');
        if (!existingContractTextMsg) {
            console.log('   📝 สร้างข้อความร่างสัญญา...');
            const messagesRef = db.collection('chats').doc(targetChatId).collection('messages');
            await messagesRef.add({
                chatId: targetChatId,
                text: `📄 **ร่างสัญญาจ้างทนายความ**\n\n${targetChat.contractText}\n\n*หมายเหตุ: สัญญาฉบับนี้มีผลสมบูรณ์แล้วเนื่องจากมีการชำระเงินเข้าระบบ*`,
                senderId: 'system',
                senderName: 'System',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'contract_draft',
                metadata: { isRepaired: true }
            });
            console.log('   ✅ Contract text posted to chat');
        }
    }

    console.log('\n✅ เสร็จสิ้น! เอกสารทั้งหมดถูกสร้างย้อนหลังเรียบร้อยแล้ว');
    console.log(`   ทนายกฤตเมธและลูกความสกาวรัตน์จะเห็นเอกสารในห้องแชท Chat ID: ${targetChatId}\n`);
    
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Script Error:', err);
    process.exit(1);
});
