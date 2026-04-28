'use server';

import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { Invoice, InvoiceStatus } from '@/lib/types/billing-types';

/**
 * Fetches invoices for a specific user (client view).
 */
export async function getUserInvoicesAction(userId: string) {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
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
export async function getLawyerInvoicesAction(lawyerId: string) {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
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
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const db = adminApp.firestore();

        const invoiceData = {
            ...data,
            status: data.status || 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            due_date: data.due_date ? admin.firestore.Timestamp.fromMillis(data.due_date) : admin.firestore.FieldValue.serverTimestamp(),
        };

        const docRef = await db.collection('invoices').add(invoiceData);
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
export async function getInvoicesByChatAction(chatId: string, userId?: string, lawyerId?: string) {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
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
export async function getContractsByChatAction(chatId: string, userId?: string) {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
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
