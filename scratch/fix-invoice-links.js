
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fixInvoiceLinks(chatId) {
    console.log(`Fixing links for chat: ${chatId}`);
    const chatRef = db.collection('chats').doc(chatId);
    const messagesRef = chatRef.collection('messages');
    
    const msgSnap = await messagesRef.where('type', '==', 'case_proposal').get();
    
    for (const doc of msgSnap.docs) {
        const data = doc.data();
        const invoiceId = data.metadata?.invoiceId || '';
        if (invoiceId) {
            const cleanId = invoiceId.trim();
            const newLink = `https://capdeal.lawslane.com/th/invoice/${encodeURIComponent(cleanId)}`;
            
            console.log(`Updating link to: ${newLink}`);
            
            // Update text and metadata
            let newText = data.text || '';
            if (newText.includes('/th/invoice/')) {
                // Replace old lawslane.com/th/invoice link with new capdeal link
                newText = newText.replace(/https?:\/\/([^\/]+)\/th\/invoice\/[^\)]+/, newLink);
            }

            await doc.ref.update({
                text: newText,
                metadata: {
                    ...data.metadata,
                    invoiceId: cleanId,
                    invoiceLink: newLink
                }
            });
        }
    }
    console.log('Done.');
}

// Target chat from screenshot
const targetChatId = '2e81d82e-c5d2-46a1-9a23-b9b45dfb6b21';
fixInvoiceLinks(targetChatId).catch(console.error);
