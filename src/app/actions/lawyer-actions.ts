'use server';

import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import type { LawyerProfile, LawyerSchedule } from '@/lib/types';
import { requireUser, requireLawyer, requireChatRole, AuthError } from '@/lib/auth-guard';

const DEFAULT_SCHEDULE: LawyerSchedule = {
    workingHours: { start: '09:00', end: '18:00' },
    availableDays: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false },
    overrides: [],
};

/**
 * Fetches a lawyer profile by ID using the Admin SDK.
 * This is used to bypass client-side permission restrictions.
 */
export async function getLawyerProfileAction(lawyerId: string): Promise<LawyerProfile | null> {
    const adminApp = await initAdmin();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized. Please check environment variables.');
    }
    const db = adminApp.firestore();

    try {
        const docSnap = await db.collection('lawyerProfiles').doc(lawyerId).get();
        if (docSnap.exists) {
            const data = docSnap.data() as any;
            
            // Helper to convert Firestore Timestamps to ISO strings or Dates
            const convertTimestamp = (val: any) => {
                if (val && typeof val.toDate === 'function') {
                    return val.toDate();
                }
                return val;
            };

            const result = {
                id: docSnap.id,
                ...data,
                dob: convertTimestamp(data?.dob),
                joinedAt: convertTimestamp(data?.joinedAt),
                createdAt: convertTimestamp(data?.createdAt),
            };

            return JSON.parse(JSON.stringify(result));
        }
        return null;
    } catch (error) {
        console.error("Error fetching lawyer profile action:", error);
        return null;
    }
}

/**
 * Updates lawyer pricing settings.
 */
export async function updateLawyerPricingAction(pricing: { 
    appointmentFee: number, 
    chatFee: number, 
    platformFeeRate: number 
}) {
    // ต้องเป็นทนายเจ้าของโปรไฟล์ — เดิมรับ lawyerId เป็น argument
    // จึงแก้ค่าบริการของทนายคนอื่นได้
    const { lawyerProfileId: lawyerId, adminApp } = await requireLawyer();
    const db = adminApp.firestore();

    try {
        await db.collection('lawyerProfiles').doc(lawyerId).update({
            pricing: pricing,
            updatedAt: new Date().toISOString()
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error updating lawyer pricing action:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * ดึงตารางเวลาของทนายที่ล็อกอินอยู่ — ใช้เติมค่าเริ่มต้นในหน้า lawyer-schedule
 */
export async function getLawyerScheduleAction(): Promise<LawyerSchedule> {
    const { lawyerProfileId: lawyerId, adminApp } = await requireLawyer();
    const db = adminApp.firestore();

    const docSnap = await db.collection('lawyerProfiles').doc(lawyerId).get();
    const schedule = docSnap.data()?.schedule;
    if (!schedule) return DEFAULT_SCHEDULE;

    return {
        workingHours: schedule.workingHours || DEFAULT_SCHEDULE.workingHours,
        availableDays: { ...DEFAULT_SCHEDULE.availableDays, ...(schedule.availableDays || {}) },
        overrides: Array.isArray(schedule.overrides) ? schedule.overrides : [],
    };
}

/**
 * บันทึกตารางเวลาของทนายที่ล็อกอินอยู่ (หน้าเดิม lawyer-schedule/page.tsx กด "บันทึก" แล้ว
 * แค่ console.log + toast ไม่เขียน Firestore จริง) — ให้หน้าจองของลูกความอ่านค่านี้ต่อ
 */
export async function updateLawyerScheduleAction(schedule: LawyerSchedule) {
    const { lawyerProfileId: lawyerId, adminApp } = await requireLawyer();
    const db = adminApp.firestore();

    if (!schedule?.workingHours?.start || !schedule?.workingHours?.end) {
        return { success: false, error: 'ข้อมูลเวลาทำงานไม่ถูกต้อง' };
    }

    try {
        await db.collection('lawyerProfiles').doc(lawyerId).update({
            schedule: {
                workingHours: schedule.workingHours,
                availableDays: schedule.availableDays,
                overrides: (schedule.overrides || []).map(ov => ({ date: ov.date, reason: ov.reason })),
            },
            updatedAt: new Date().toISOString(),
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating lawyer schedule:', error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Fetches global platform settings (like GP rate).
 */
export async function getPlatformSettingsAction() {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        const settingsDoc = await db.collection('settings').doc('platform').get();
        if (settingsDoc.exists) {
            return JSON.parse(JSON.stringify(settingsDoc.data()));
        }
        return { platformFeeRate: 0.15 }; // Default fallback
    } catch (error) {
        console.error("Error fetching platform settings action:", error);
        return { platformFeeRate: 0.15 };
    }
}

/**
 * Checks the role of a specific user.
 */
export async function getUserRoleAction() {
    // คืน role ของผู้เรียกเองเท่านั้น — เดิมรับ userId เป็น argument
    const { uid: userId, adminApp } = await requireUser();
    const db = adminApp.firestore();

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        return JSON.parse(JSON.stringify(userDoc.exists ? (userDoc.data()?.role || 'customer') : 'customer'));
    } catch (error) {
        console.error("Error fetching user role action:", error);
        return 'customer';
    }
}

/**
 * Adds a lawyer to the verified registry.
 */
export async function addToVerifiedRegistry(data: {
    licenseNumber: string;
    firstName: string;
    lastName: string;
    province: string;
}) {
    // เรียกตอนสมัครทนาย (หลัง mint session แล้ว) — ต้องล็อกอินอยู่จริง
    // เดิมเปิดให้ใครก็เพิ่มรายชื่อเข้าทะเบียนทนายที่ยืนยันแล้วได้
    const { adminApp } = await requireUser();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        // Sanitize ID
        const docId = data.licenseNumber.replace(/\//g, '-');

        await db.collection('verifiedLawyers').doc(docId).set({
            licenseNumber: data.licenseNumber,
            firstName: data.firstName,
            lastName: data.lastName,
            province: data.province,
            status: 'pending',
            registeredDate: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error adding to verified registry action:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Creates or updates a manual case (Chat document) for a lawyer.
 */
export async function createManualCaseAction(data: {
    title: string;
    description: string;
    category: string;
    amount: number;
    installments?: { description: string, amount: string }[];
    clientInfo?: { name: string, address: string, taxId: string };
    existingChatId?: string;
    clientId?: string;
    contractText?: string;
}) {
    // ต้องเป็นทนายจริง และเคสถูกผูกกับโปรไฟล์ของผู้เรียกเอง
    const { lawyerProfileId: lawyerId, adminApp } = await requireLawyer();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        const chatId = data.existingChatId || db.collection('chats').doc().id;
        const chatRef = db.collection('chats').doc(chatId);

        // Resolve clientId from existing chat if not provided
        let resolvedClientId = data.clientId;
        if (!resolvedClientId && data.existingChatId) {
            const existingChat = await chatRef.get();
            if (existingChat.exists) {
                const chatData = existingChat.data();
                resolvedClientId = chatData?.clientId || chatData?.userId || 
                    chatData?.participants?.find((p: string) => p !== lawyerId);
            }
        }

        const chatPayload: any = {
            lawyerId: lawyerId,
            caseTitle: data.title,
            description: data.description,
            category: data.category,
            amount: data.amount,
            status: 'pending_payment',
            isManualCase: true,
            installments: (data.installments || []).map((inst, idx) => ({
                ...inst,
                status: 'pending' as const,
                index: idx,
            })),
            paidInstallments: 0,
            totalPaid: 0,
            clientInfo: data.clientInfo || null,
            contractText: data.contractText || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMessage: `ข้อเสนอเปิดคดี: ${data.title} จำนวน ฿${data.amount.toLocaleString()}`,
        };

        // Set clientId/userId fields for easier querying
        if (resolvedClientId) {
            chatPayload.clientId = resolvedClientId;
            chatPayload.userId = resolvedClientId;
        }

        if (!data.existingChatId) {
            // New chat: include both lawyerId and clientId in participants
            chatPayload.participants = resolvedClientId 
                ? [lawyerId, resolvedClientId] 
                : [lawyerId];
            chatPayload.createdAt = admin.firestore.FieldValue.serverTimestamp();
        } else if (resolvedClientId) {
            // Existing chat: ensure clientId is in participants
            chatPayload.participants = admin.firestore.FieldValue.arrayUnion(lawyerId, resolvedClientId);
        }

        const chatRes = await chatRef.set(chatPayload, { merge: true });

        // BILLING FIX: Reset pending payment flags to prevent old consultation slips from being inherited
        await chatRef.update({
            hasNewPayment: false,
            pendingPaymentDetails: admin.firestore.FieldValue.delete(),
        });

        // (A) Create a formal Invoice/Proposal document
        const invoiceRef = db.collection('invoices').doc();
        const invoiceId = invoiceRef.id;
        const invoicePayload = {
            chatId: chatId,
            userId: resolvedClientId || 'unknown',
            lawyerId: lawyerId,
            title: `ใบเสนอราคา: ${data.title}`,
            amount: data.amount,
            status: 'pending',
            type: 'proposal',
            items: (data.installments || []).map(inst => ({
                description: inst.description,
                amount: parseFloat(String(inst.amount).replace(/,/g, '')),
            })),
            clientInfo: data.clientInfo || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await invoiceRef.set(invoicePayload);

        // FEED VISIBILITY FIX: Post a formal system message with a document link
        const invoiceLink = `/chat/${chatId}`;
        const messagesRef = chatRef.collection('messages');
        const newMessageRef = messagesRef.doc();
        const proposalMessage = {
            chatId: chatId,
            text: `📄 **เอกสารใบเสนอราคาใหม่**\n\n**หัวข้อ:** ${data.title}\n**ยอดรวมทั้งสิ้น:** ฿${data.amount.toLocaleString()}\n\nคุณสามารถตรวจสอบรายละเอียดใบเสนอราคาอย่างเป็นทางการและดาวน์โหลดเอกสาร PDF ได้ที่ลิงก์ด้านล่างนี้:\n\n🔗 [ดูใบเสนอราคาที่นี่](${invoiceLink})\n\nกรุณาตรวจสอบและดำเนินการชำระเงินตามงวดงานในเมนู "ข้อเสนอคดี" เพื่อเริ่มดำเนินคดีครับ`,
            senderId: 'system',
            senderName: 'System',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'case_proposal',
            metadata: {
                caseTitle: data.title,
                amount: data.amount,
                invoiceId: invoiceId,
                invoiceLink: invoiceLink,
                isManualCase: true
            }
        };
        await newMessageRef.set(proposalMessage);

        // (B) The Contract/Agreement Message (NEW)
        if (data.contractText) {
            const contractMsgRef = messagesRef.doc();
            await contractMsgRef.set({
                chatId: chatId,
                text: `📄 **ร่างสัญญาจ้างทนายความ**\n\n${data.contractText}\n\n*หมายเหตุ: สัญญาฉบับนี้จะมีผลสมบูรณ์เมื่อมีการชำระเงินงวดแรกเข้าระบบ*`,
                senderId: 'system',
                senderName: 'System',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'contract_draft'
            });
        }

        // (C) The Payment Instruction Message (NEW)
        const paymentMsgRef = messagesRef.doc();
        const paymentLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://lawslane.com'}/payment?chatId=${chatId}&type=case`;
        await paymentMsgRef.set({
            chatId: chatId,
            text: `💳 **ช่องทางการชำระเงิน**\n\nคุณสามารถชำระเงินผ่านระบบ Thai QR Payment หรือบัตรเครดิตได้โดยตรงที่ลิงก์ด้านล่างนี้:\n\n🔗 [ชำระเงินที่นี่](${paymentLink})\n\n*เงินของคุณจะถูกเก็บไว้ในระบบ Escrow ของ Lawslane และจะโอนให้ทนายความตามงวดงานที่ตกลงกันเท่านั้น*`,
            senderId: 'system',
            senderName: 'System',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'payment_instruction'
        });

        // NOTIFICATION: Trigger Email/Push and In-App notification to the client
        if (resolvedClientId) {
            try {
                // 1. Create In-App Notification with Payment Link
                const notificationRef = db.collection('notifications').doc();
                await notificationRef.set({
                    type: 'payment',
                    title: `ใบเสนอราคาเปิดคดีใหม่`,
                    message: `คุณได้รับข้อเสนอคดี: ${data.title} จำนวน ฿${data.amount.toLocaleString()} กรุณากดเพื่อตรวจสอบและชำระเงิน`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false,
                    recipient: resolvedClientId,
                    link: `/payment?chatId=${chatId}&type=case`,
                    relatedId: chatId
                });

                // 2. Trigger Email Notification
                const { NotificationService } = await import('@/services/notification-service');
                const clientDoc = await db.collection('users').doc(resolvedClientId).get();
                const lawyerDoc = await db.collection('lawyerProfiles').doc(lawyerId).get();
                
                if (clientDoc.exists) {
                    const clientData = clientDoc.data();
                    const lawyerData = lawyerDoc.data();
                    
                    console.log(`[NotificationTrigger] Triggering emails for: ${clientData?.email}`);
                    if (!clientData?.email) {
                        console.error("❌ NotificationTrigger: Client email is missing in Firestore!");
                    }
                    
                    await NotificationService.notifyNewCaseProposal({
                        clientName: clientData?.name || 'ลูกความ',
                        clientEmail: clientData?.email || '',
                        lawyerName: lawyerData?.name || 'ทนายความ',
                        caseTitle: data.title,
                        amount: data.amount,
                        chatId: chatId,
                    });
                }
            } catch (notifyErr) {
                console.error("Non-blocking notification error:", notifyErr);
            }
        }

        // DUAL-WRITE: Create/Update the Pipeline document (legalCases)
        try {
            const legalCaseRef = db.collection('legalCases').doc(chatId);
            const legalCaseData: any = {
                lawyer_id: lawyerId,
                client_id: resolvedClientId || 'unknown',
                title: data.title,
                description: data.description,
                status: 'pending', // Initial status for Pipeline
                updatedAt: Date.now(),
            };

            // Only set createdAt if it doesn't exist
            const existingLegalCase = await legalCaseRef.get();
            if (!existingLegalCase.exists) {
                legalCaseData.createdAt = Date.now();
            }

            await legalCaseRef.set(legalCaseData, { merge: true });
        } catch (legalCaseErr) {
            console.error("Failed to sync legalCase to Pipeline (non-blocking):", legalCaseErr);
        }

        return JSON.parse(JSON.stringify({ success: true, chatId: chatId }));
    } catch (error: any) {
        console.error("Error creating/updating manual case action:", error);
        return JSON.parse(JSON.stringify({ success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' }));
    }
}

/**
 * Fetches unique clients who have interacted with a specific lawyer.
 */
export async function getLawyerClientsAction() {
    // รายชื่อลูกความของทนายคนที่ล็อกอินอยู่เท่านั้น
    const { uid: lawyerId, adminApp } = await requireLawyer();
    const db = adminApp.firestore();

    try {
        // Query chats where this lawyer is a participant
        const chatsSnap = await db.collection('chats')
            .where('participants', 'array-contains', lawyerId)
            .get();

        const clientIds = new Set<string>();
        chatsSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.participants) {
                data.participants.forEach((p: string) => {
                    if (p !== lawyerId) clientIds.add(p);
                });
            }
        });

        if (clientIds.size === 0) return [];

        const clients: any[] = [];
        const ids = Array.from(clientIds);
        
        // Firestore 'in' query limit is 30, but we'll use 10 for safety
        for (let i = 0; i < ids.length; i += 10) {
            const chunk = ids.slice(i, i + 10);
            const usersSnap = await db.collection('users')
                .where('__name__', 'in', chunk)
                .get();
            
            usersSnap.docs.forEach(doc => {
                const userData = doc.data();
                clients.push({
                    id: doc.id,
                    name: userData.name || 'Anonymous Client',
                    email: userData.email,
                    avatar: userData.avatar || ''
                });
            });
        }

        return JSON.parse(JSON.stringify(clients));
    } catch (error) {
        console.error("Error fetching lawyer clients:", error);
        return [];
    }
}

/**
 * Repairs documents for an existing chat. 
 * Creates missing invoices/proposals and posts the link to the chat.
 */
export async function repairChatDocumentsAction(chatId: string) {
    // ต้องเป็นคู่กรณีของแชทนี้
    const { adminApp } = await requireChatRole(chatId);
    const db = adminApp.firestore();

    try {
        const chatRef = db.collection('chats').doc(chatId);
        const chatSnap = await chatRef.get();
        if (!chatSnap.exists) return { success: false, error: 'Chat not found' };

        const chatData = chatSnap.data() || {};
        const isOfficial = (chatData.amount || 0) > 0 || (chatData.installments && chatData.installments.length > 0);
        
        if (!isOfficial) return { success: false, error: 'Case is not official' };

        // Broad search for existing invoice
        const invQueries = [
            db.collection('invoices').where('chatId', '==', chatId).get(),
            db.collection('invoices').where('caseId', '==', chatId).get(),
            db.collection('invoices').where('case_id', '==', chatId).get(),
            db.collection('invoices').where('chat_id', '==', chatId).get()
        ];
        const invSnaps = await Promise.all(invQueries);
        let existingInv = null;
        for (const snap of invSnaps) {
            if (!snap.empty) {
                existingInv = snap.docs[0];
                break;
            }
        }

        let invoiceId = '';
        
        if (!existingInv) {
            // Create missing invoice
            const invoiceRef = db.collection('invoices').doc();
            invoiceId = invoiceRef.id;
            await invoiceRef.set({
                chatId: chatId,
                userId: chatData.userId || chatData.clientId || 'unknown',
                lawyerId: chatData.lawyerId || 'unknown',
                title: `สัญญาจ้างทนายความ: ${chatData.caseTitle || 'เคส'}`,
                amount: chatData.amount || 0,
                status: chatData.status === 'active' || chatData.status === 'paid' ? 'paid' : 'pending',
                type: 'proposal',
                items: (chatData.installments || []).map((inst: any) => ({
                    description: inst.description,
                    amount: parseFloat(String(inst.amount).replace(/,/g, '')),
                })),
                clientInfo: chatData.clientInfo || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // AUTO-REPAIR: If we just created a 'paid' invoice for a manual case, 
            // we should also mark the installments in the chat document as paid.
            if (chatData.status === 'active' || chatData.status === 'paid') {
                const updatedInstallments = (chatData.installments || []).map((inst: any) => ({
                    ...inst,
                    status: 'paid',
                    paidAt: new Date().toISOString()
                }));
                await chatRef.update({ installments: updatedInstallments });
            }
        } else {
            invoiceId = existingInv.id.trim();
        }

        // Post the professional link to the chat if not already present
        // IMPORTANT: Use internal link for invoice viewing
        const invoiceLink = `/chat/${chatId}`;
        const messagesRef = chatRef.collection('messages');
        
        // Check for existing proposal message
        const msgSnap = await messagesRef.where('type', '==', 'case_proposal').get();
        if (msgSnap.empty) {
            await messagesRef.add({
                chatId: chatId,
                text: `📄 **เอกสารใบเสนอราคาและใบแจ้งหนี้ (ฉบับสมบูรณ์)**\n\n**หัวข้อ:** ${chatData.caseTitle}\n**ยอดเงินรวม:** ฿${(chatData.amount || 0).toLocaleString()}\n\nคุณสามารถตรวจสอบรายละเอียดเอกสารและดาวน์โหลด PDF ได้ที่ลิงก์ด้านล่างนี้:\n\n🔗 [ดูเอกสารที่นี่](${invoiceLink})`,
                senderId: 'system',
                senderName: 'System',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'case_proposal',
                metadata: {
                    caseTitle: chatData.caseTitle,
                    amount: chatData.amount,
                    invoiceId: invoiceId,
                    invoiceLink: invoiceLink,
                    isManualCase: true
                }
            });
        } else {
            // Update the existing message with the professional link
            const oldMsgDoc = msgSnap.docs[0];
            const oldMetadata = oldMsgDoc.data().metadata || {};
            await oldMsgDoc.ref.update({
                metadata: {
                    ...oldMetadata,
                    invoiceId: invoiceId,
                    invoiceLink: invoiceLink
                }
            });
        }

        return { success: true, invoiceId, invoiceLink };
    } catch (error: any) {
        console.error("Error repairing documents:", error);
        return { success: false, error: error.message };
    }
}

/**
 * ทนายรับ / ปฏิเสธคำขอนัดหมาย — ต้องทำฝั่ง server
 *
 * เดิมหน้า lawyer-dashboard/request/[id] ยิง updateDoc(appointments/{id}) และ
 * addDoc(chats, {...}) จากเบราว์เซอร์ตรงๆ ซึ่งต้องพึ่ง `allow create: if isSignedIn()`
 * ของ chats — กฎเดียวกับที่ทำให้ใครก็สร้างเคสพร้อม `amount: 0, status: 'paid'` ได้
 * ย้ายมาที่นี่เพื่อให้ปิดกฎนั้นได้ และเพื่อยืนยันว่าคนกดรับเป็นทนายเจ้าของคำขอจริง
 */
export async function respondToAppointmentRequestAction(input: {
    appointmentId: string;
    decision: 'accept' | 'reject';
}): Promise<{ ok: true; chatId?: string } | { ok: false; error: string }> {
    try {
        const { uid, adminApp } = await requireLawyer();
        const db = adminApp.firestore();

        const apptRef = db.collection('appointments').doc(input.appointmentId);
        const snap = await apptRef.get();
        if (!snap.exists) return { ok: false, error: 'ไม่พบคำขอนัดหมายนี้' };

        const appt = snap.data()!;
        // คำขอนี้เป็นของทนายคนนี้จริงไหม — ห้ามรับเคสแทนคนอื่น
        if (appt.lawyerId !== uid && appt.lawyerUserId !== uid) {
            return { ok: false, error: 'คำขอนี้ไม่ใช่ของคุณ' };
        }

        if (input.decision === 'reject') {
            await apptRef.update({
                status: 'cancelled',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { ok: true };
        }

        const clientId = appt.userId || appt.clientId;
        if (!clientId) return { ok: false, error: 'ไม่พบข้อมูลลูกความของคำขอนี้' };

        const chatRef = db.collection('chats').doc();
        const batch = db.batch();
        batch.update(apptRef, {
            status: 'confirmed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            chatId: chatRef.id,
        });
        batch.set(chatRef, {
            participants: [uid, clientId],
            lawyerId: uid,
            userId: clientId,
            caseTitle: appt.caseTitle || appt.description || 'เคสจากคำขอนัดหมาย',
            status: 'active',
            // ห้องนี้เกิดจากนัดหมายที่ชำระเงินแล้ว ยอดอยู่ที่เอกสาร appointments
            // ไม่ตั้ง amount ซ้ำตรงนี้เพื่อไม่ให้ถูกนับรายได้สองรอบ
            appointmentId: input.appointmentId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMessage: 'Case accepted',
        });
        await batch.commit();

        return { ok: true, chatId: chatRef.id };
    } catch (e) {
        if (e instanceof AuthError) return { ok: false, error: e.message };
        console.error('respondToAppointmentRequestAction failed:', e);
        return { ok: false, error: 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
    }
}
