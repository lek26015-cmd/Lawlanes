'use server';

import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { Invoice, InvoiceStatus } from '@/lib/types/billing-types';
import { requireUser, requireLawyer, requireChatRole, authErrorResult } from '@/lib/auth-guard';
import { logCaseEvent } from '@/lib/telemetry/case-events';

/**
 * Fetches invoices for a specific user (client view).
 */
export async function getUserInvoicesAction() {
    // uid มาจาก session — เดิมรับ userId เป็น argument จึงดึงใบแจ้งหนี้ของคนอื่นได้
    let userId: string, adminApp;
    try {
        ({ uid: userId, adminApp } = await requireUser());
    } catch (e) {
        return authErrorResult(e);
    }

    try {
        const db = adminApp.firestore();

        const invoicesRef = db.collection('invoices');
        const snapshot = await invoicesRef.where('client_id', '==', userId).get();

        const invoices: Invoice[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : (data.createdAt || Date.now()),
                due_date: data.due_date?.toDate ? data.due_date.toDate().getTime() : (data.due_date || Date.now()),
                paidAt: data.paidAt?.toDate ? data.paidAt.toDate().getTime() : data.paidAt,
            } as Invoice;
        });

        // Sort by creation date descending
        invoices.sort((a, b) => b.createdAt - a.createdAt);

        return { success: true, data: invoices };
    } catch (error: any) {
        console.error("Error fetching user invoices:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches invoices for a specific lawyer.
 */
export async function getLawyerInvoicesAction() {
    // uid มาจาก session — เดิมรับ lawyerId เป็น argument
    let lawyerId: string, adminApp;
    try {
        ({ uid: lawyerId, adminApp } = await requireUser());
    } catch (e) {
        return authErrorResult(e);
    }

    try {
        const db = adminApp.firestore();

        // In our schema, invoices might be stored with lawyer_id or we might need to find them via cases
        // For now, let's assume they have a lawyer_id field or we fetch by lawyer_id
        const invoicesRef = db.collection('invoices');
        const snapshot = await invoicesRef.where('lawyer_id', '==', lawyerId).get();

        const invoices: Invoice[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : (data.createdAt || Date.now()),
                due_date: data.due_date?.toDate ? data.due_date.toDate().getTime() : (data.due_date || Date.now()),
                paidAt: data.paidAt?.toDate ? data.paidAt.toDate().getTime() : data.paidAt,
            } as Invoice;
        });

        invoices.sort((a, b) => b.createdAt - a.createdAt);

        return { success: true, data: invoices };
    } catch (error: any) {
        console.error("Error fetching lawyer invoices:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Creates a new invoice.
 */
export async function createInvoiceAction(data: Partial<Invoice>) {
    // ผู้ออกใบแจ้งหนี้ต้องเป็นทนายจริง และ lawyer_id ถูกบังคับจาก token
    // เดิมไม่เช็คอะไรเลย → ออกใบแจ้งหนี้ในนามทนายคนไหนก็ได้ ต่อมาบังคับ lawyer_id
    // จาก token แล้วแต่ยังเป็น requireUser() เฉยๆ → ผู้ใช้ทั่วไปก็ยังยิง action
    // ออกใบแจ้งหนี้ยอดเท่าไรก็ได้ส่งหาใครก็ได้ ตอนนี้ต้องเป็นทนายที่ยืนยันแล้ว
    let callerUid: string, callerLawyerProfileId: string, adminApp;
    try {
        ({ uid: callerUid, lawyerProfileId: callerLawyerProfileId, adminApp } = await requireLawyer());
    } catch (e) {
        return authErrorResult(e);
    }

    try {
        const db = adminApp.firestore();

        const amount = Number(data.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            return { success: false, error: 'ยอดใบแจ้งหนี้ไม่ถูกต้อง' };
        }

        const invoiceData = {
            ...data,
            amount,
            lawyer_id: callerUid,
            status: 'pending' as InvoiceStatus,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            due_date: data.due_date ? admin.firestore.Timestamp.fromMillis(data.due_date) : admin.firestore.FieldValue.serverTimestamp(),
        };

        const docRef = await db.collection('invoices').add(invoiceData);

        // Telemetry ชั้น B — ป้อน activityDepth (เคสที่มี artifact จริงในระบบ)
        const invoiceCaseId = data.chatId || data.case_id;
        if (invoiceCaseId) {
            await logCaseEvent(db, {
                caseId: invoiceCaseId, lawyerId: callerLawyerProfileId,
                type: 'invoice_created', actor: 'lawyer',
            });
        }

        return { success: true, id: docRef.id };
    } catch (error: any) {
        console.error("Error creating invoice:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches invoices for a specific chat.
 * Robust search across multiple possible linking fields.
 */
export async function getInvoicesByChatAction(chatId: string) {
    // ต้องเป็นคู่กรณีของเคสนี้จริง — เดิมรับ userId/lawyerId จากผู้เรียกแล้วใช้ค้นหาเลย
    let userId: string, adminApp;
    try {
        ({ uid: userId, adminApp } = await requireChatRole(chatId));
    } catch (e) {
        return authErrorResult(e);
    }

    try {
        const db = adminApp.firestore();

        // 1. Try searching by all possible linking IDs
        const queries = [
            db.collection('invoices').where('chatId', '==', chatId).get(),
            db.collection('invoices').where('case_id', '==', chatId).get(),
            db.collection('invoices').where('caseId', '==', chatId).get(),
            db.collection('invoices').where('chat_id', '==', chatId).get()
        ];

        // 2. Fallback: Search by userId/lawyerId if provided
        if (userId) {
            queries.push(db.collection('invoices').where('userId', '==', userId).limit(20).get());
            queries.push(db.collection('invoices').where('client_id', '==', userId).limit(20).get());
        }

        const snapshots = await Promise.all(queries);
        const allDocs = new Map();

        snapshots.forEach(snap => {
            snap.docs.forEach(doc => {
                const data = doc.data();
                // If it's a fallback search, ensure it's either this chat or has no chat ID but matches participants
                const belongsToChat = data.chatId === chatId || data.case_id === chatId || data.caseId === chatId || data.chat_id === chatId;
                
                if (belongsToChat || (userId && (data.userId === userId || data.client_id === userId))) {
                    allDocs.set(doc.id, { id: doc.id, ...data });
                }
            });
        });

        const invoices = Array.from(allDocs.values()).map(data => ({
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : (data.createdAt || Date.now()),
            due_date: data.due_date?.toDate ? data.due_date.toDate().getTime() : (data.due_date || Date.now()),
            paidAt: data.paidAt?.toDate ? data.paidAt.toDate().getTime() : data.paidAt,
        })) as Invoice[];

        invoices.sort((a, b) => b.createdAt - a.createdAt);

        return { success: true, data: JSON.parse(JSON.stringify(invoices)) };
    } catch (error: any) {
        console.error("Error fetching chat invoices:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches contracts for a specific chat.
 */
export async function getContractsByChatAction(chatId: string) {
    // ต้องเป็นคู่กรณีของเคสนี้จริง
    let userId: string, adminApp;
    try {
        ({ uid: userId, adminApp } = await requireChatRole(chatId));
    } catch (e) {
        return authErrorResult(e);
    }

    try {
        const db = adminApp.firestore();

        const queries = [
            db.collection('contracts').where('chatId', '==', chatId).get(),
            db.collection('contracts').where('case_id', '==', chatId).get(),
            db.collection('contracts').where('caseId', '==', chatId).get(),
            db.collection('contracts').where('chat_id', '==', chatId).get()
        ];

        if (userId) {
            queries.push(db.collection('contracts').where('userId', '==', userId).limit(20).get());
        }

        const snapshots = await Promise.all(queries);
        const allDocs = new Map();

        snapshots.forEach(snap => {
            snap.docs.forEach(doc => {
                const data = doc.data();
                const belongsToChat = data.chatId === chatId || data.case_id === chatId || data.caseId === chatId || data.chat_id === chatId;
                
                if (belongsToChat || (userId && data.userId === userId)) {
                    allDocs.set(doc.id, { id: doc.id, ...data });
                }
            });
        });

        const contracts = Array.from(allDocs.values()).map(data => ({
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : (data.createdAt || Date.now()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().getTime() : (data.updatedAt || Date.now()),
        }));

        contracts.sort((a, b) => b.createdAt - a.createdAt);

        return { success: true, data: JSON.parse(JSON.stringify(contracts)) };
    } catch (error: any) {
        console.error("Error fetching chat contracts:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches a specific contract by ID using Admin SDK
 */

/**
 * เอกสาร (สัญญา/ใบแจ้งหนี้) ใบนี้เป็นของผู้เรียกหรือไม่
 * ชื่อฟิลด์ในข้อมูลจริงปนกันหลายแบบ จึงต้องเทียบทุกชื่อที่เคยใช้
 */
async function callerOwnsBillingDoc(
    db: admin.firestore.Firestore,
    data: any,
    uid: string,
    isAdmin: boolean
): Promise<boolean> {
    if (isAdmin) return true;

    const directIds = [
        data.userId, data.client_id, data.clientId,
        data.lawyer_id, data.ownerId,
    ].filter(Boolean);
    if (directIds.includes(uid)) return true;

    // lawyerId มักเป็น id ของ lawyerProfiles ไม่ใช่ auth uid จึงต้องตามอีกชั้น
    if (data.lawyerId) {
        const snap = await db.collection('lawyerProfiles').doc(data.lawyerId).get();
        if (snap.exists && snap.data()?.userId === uid) return true;
    }
    return false;
}

export async function getContractByIdAction(contractId: string) {
    // เดิมไม่เช็คอะไรเลย — รู้ contractId ก็อ่านสัญญาของคนอื่นได้
    let uid: string, isAdmin: boolean, adminApp;
    try {
        const session = await requireUser();
        uid = session.uid;
        isAdmin = session.token.admin === true || session.token.role === 'admin';
        adminApp = session.adminApp;
    } catch (e) {
        return authErrorResult(e);
    }

    try {
        const db = adminApp.firestore();

        let docSnap: any = await db.collection('contracts').doc(contractId).get();
        let data: any = null;

        if (!docSnap.exists) {
            // Fallback: Check if contractId is actually a chatId (since scripts generated links with chatId)
            const queries = [
                db.collection('contracts').where('chatId', '==', contractId).limit(1).get(),
                db.collection('contracts').where('case_id', '==', contractId).limit(1).get(),
                db.collection('contracts').where('caseId', '==', contractId).limit(1).get(),
                db.collection('contracts').where('chat_id', '==', contractId).limit(1).get()
            ];
            
            const snapshots = await Promise.all(queries);
            let found = false;
            for (const snap of snapshots) {
                if (!snap.empty) {
                    docSnap = snap.docs[0];
                    found = true;
                    break;
                }
            }
            if (!found) {
                return { success: false, error: 'ไม่พบสัญญา' };
            }
        }

        data = docSnap.data();

        if (!(await callerOwnsBillingDoc(db, data, uid, isAdmin))) {
            return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงเอกสารนี้' };
        }

        let clientName = data.clientName;
        let lawyerName = data.lawyerName;

        if (!clientName && data.userId) {
            const userSnap = await db.collection('users').doc(data.userId).get();
            if (userSnap.exists) {
                clientName = userSnap.data()?.name || userSnap.data()?.displayName || 'ลูกความ';
            }
        }

        if (!lawyerName && data.lawyerId) {
            let foundLawyer = false;
            // try lawyerProfiles first
            const lawyerSnap = await db.collection('lawyerProfiles').doc(data.lawyerId).get();
            if (lawyerSnap.exists) {
                lawyerName = lawyerSnap.data()?.name || lawyerSnap.data()?.fullName || 'ทนายความ';
                foundLawyer = true;
            }
            // fallback to users collection
            if (!foundLawyer) {
                const userSnap = await db.collection('users').doc(data.lawyerId).get();
                if (userSnap.exists) {
                    lawyerName = userSnap.data()?.name || userSnap.data()?.displayName || 'ทนายความ';
                }
            }
        }

        const contract = {
            id: docSnap.id,
            ...data,
            clientName: clientName || 'ลูกความ',
            lawyerName: lawyerName || 'ทนายความ',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : (data.createdAt || Date.now()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().getTime() : (data.updatedAt || Date.now()),
        };

        return { success: true, data: JSON.parse(JSON.stringify(contract)) };
    } catch (error: any) {
        console.error("Error fetching contract:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches a specific invoice by ID using Admin SDK
 */
export async function getInvoiceByIdAction(invoiceId: string) {
    // เดิมไม่เช็คอะไรเลย — รู้ invoiceId ก็อ่านใบแจ้งหนี้ของคนอื่นได้
    let uid: string, isAdmin: boolean, adminApp;
    try {
        const session = await requireUser();
        uid = session.uid;
        isAdmin = session.token.admin === true || session.token.role === 'admin';
        adminApp = session.adminApp;
    } catch (e) {
        return authErrorResult(e);
    }

    try {
        const db = adminApp.firestore();

        let docSnap: any = await db.collection('invoices').doc(invoiceId).get();
        let data: any = null;

        if (!docSnap.exists) {
            // Fallback: Check if invoiceId is actually a chatId (since scripts generated links with chatId)
            const queries = [
                db.collection('invoices').where('chatId', '==', invoiceId).limit(1).get(),
                db.collection('invoices').where('case_id', '==', invoiceId).limit(1).get(),
                db.collection('invoices').where('caseId', '==', invoiceId).limit(1).get(),
                db.collection('invoices').where('chat_id', '==', invoiceId).limit(1).get()
            ];
            
            const snapshots = await Promise.all(queries);
            let found = false;
            for (const snap of snapshots) {
                if (!snap.empty) {
                    docSnap = snap.docs[0];
                    found = true;
                    break;
                }
            }
            if (!found) {
                return { success: false, error: 'ไม่พบใบแจ้งหนี้' };
            }
        }

        data = docSnap.data();

        if (!(await callerOwnsBillingDoc(db, data, uid, isAdmin))) {
            return { success: false, error: 'ไม่มีสิทธิ์เข้าถึงเอกสารนี้' };
        }

        const invoice = {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : (data.createdAt || Date.now()),
            due_date: data.due_date?.toDate ? data.due_date.toDate().getTime() : (data.due_date || Date.now()),
            paidAt: data.paidAt?.toDate ? data.paidAt.toDate().getTime() : data.paidAt,
        };

        return { success: true, data: JSON.parse(JSON.stringify(invoice)) };
    } catch (error: any) {
        console.error("Error fetching invoice:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Signs a contract by chatId and role. Creates a formal contract if missing.
 */
export async function signContractAction(chatId: string, signatureDataUrl?: string) {
    // บทบาทต้องมาจากข้อมูลเคสจริง ไม่ใช่จากที่ผู้เรียกประกาศเอง
    // เดิมรับ role: 'client' | 'lawyer' เป็น argument → เซ็นแทนอีกฝ่ายได้
    let role: 'client' | 'lawyer' | 'admin', adminApp;
    let signChatData: FirebaseFirestore.DocumentData;
    try {
        ({ role, adminApp, chatData: signChatData } = await requireChatRole(chatId));
    } catch (e) {
        return authErrorResult(e);
    }

    if (role === 'admin') {
        return { success: false, error: 'ผู้ดูแลระบบลงนามแทนคู่สัญญาไม่ได้' };
    }

    try {
        const db = adminApp.firestore();

        // 1. Search for existing contract for this chat
        const queries = [
            db.collection('contracts').where('chatId', '==', chatId).get(),
            db.collection('contracts').where('case_id', '==', chatId).get(),
            db.collection('contracts').where('caseId', '==', chatId).get(),
            db.collection('contracts').where('chat_id', '==', chatId).get()
        ];
        
        const snapshots = await Promise.all(queries);
        let existingContractDoc: admin.firestore.QueryDocumentSnapshot | null = null;
        
        for (const snap of snapshots) {
            if (!snap.empty) {
                existingContractDoc = snap.docs[0];
                break;
            }
        }

        const now = new Date().toISOString();
        const updateData: any = {};
        
        if (role === 'client') {
            updateData.clientSigned = true;
            updateData.clientSignedAt = now;
            if (signatureDataUrl) updateData.clientSignatureImage = signatureDataUrl;
        } else {
            updateData.lawyerSigned = true;
            updateData.lawyerSignedAt = now;
            if (signatureDataUrl) updateData.lawyerSignatureImage = signatureDataUrl;
        }

        if (existingContractDoc) {
            // Update existing contract
            const data = existingContractDoc.data();
            const bothSigned = (role === 'client' ? data.lawyerSigned : data.clientSigned) === true;
            updateData.status = bothSigned ? 'signed' : 'pending';
            
            await existingContractDoc.ref.update(updateData);

            // Telemetry ชั้น B — นับเฉพาะตอนครบสองลายเซ็น (สัญญามีผลจริง)
            const signLawyerId = signChatData.lawyerId || signChatData.lawyer_id || '';
            if (bothSigned && signLawyerId) {
                await logCaseEvent(db, {
                    caseId: chatId, lawyerId: signLawyerId,
                    type: 'contract_signed', actor: 'system',
                });
            }

            return { success: true, contractId: existingContractDoc.id };
        } else {
            // No contract exists (Bug #7 fix). We need to create one based on chat data.
            const chatSnap = await db.collection('chats').doc(chatId).get();
            if (!chatSnap.exists) return { success: false, error: 'ไม่พบข้อมูลคดี' };
            
            const chatData = chatSnap.data() || {};
            
            const lawyerId = chatData.lawyerId || chatData.lawyer_id || '';
            const clientId = chatData.clientId || chatData.userId || chatData.client_id || '';
            
            let clientName = 'ลูกความ';
            let lawyerName = 'ทนายความ';
            try {
                if (clientId) {
                    const cDoc = await db.collection('users').doc(clientId).get();
                    if (cDoc.exists) clientName = cDoc.data()?.name || clientName;
                }
                if (lawyerId) {
                    const lDoc = await db.collection('lawyerProfiles').doc(lawyerId).get();
                    if (lDoc.exists) lawyerName = lDoc.data()?.name || lawyerName;
                }
            } catch (_) {}

            updateData.userId = clientId;
            updateData.lawyerId = lawyerId;
            updateData.chatId = chatId;
            updateData.title = chatData.caseTitle || chatData.title || 'สัญญาจ้างทนายความ';
            updateData.task = chatData.caseTitle || chatData.title || 'การดำเนินคดีทางกฎหมาย';
            updateData.description = chatData.description || '';
            updateData.price = chatData.amount || 0;
            updateData.installments = chatData.installments || [];
            updateData.clientName = clientName;
            updateData.lawyerName = lawyerName;
            updateData.clientInfo = chatData.clientInfo || null;
            updateData.status = 'pending';
            updateData.createdAt = admin.firestore.FieldValue.serverTimestamp();
            updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            const newContractRef = db.collection('contracts').doc();
            await newContractRef.set(updateData);
            return { success: true, contractId: newContractRef.id };
        }
    } catch (error: any) {
        console.error("Error signing contract:", error);
        return { success: false, error: error.message };
    }
}
