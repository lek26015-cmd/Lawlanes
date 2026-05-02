'use server';

import { initAdmin } from '@/lib/firebase-admin';
import type { Case, UpcomingAppointment, ReportedTicket, LawyerCase, LawyerAppointmentRequest } from '@/lib/types';

export async function getUserDashboardData(userId: string) {
    const adminApp = await initAdmin();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized. Please check environment variables.');
    }
    const db = adminApp.firestore();

    try {
        // 1. Fetch Cases (Chats)
        const chatsRef = db.collection('chats');

        // Query by participants
        const q1 = chatsRef.where('participants', 'array-contains', userId).get();
        const q2 = chatsRef.where('userId', '==', userId).get();

        const [pSnap, uSnap] = await Promise.all([q1, q2]);

        const chatDocs = new Map();
        pSnap.docs.forEach(d => chatDocs.set(d.id, d));
        uSnap.docs.forEach(d => chatDocs.set(d.id, d));

        const cases: Case[] = [];
        const lawyerCache = new Map();

        const getLawyerDetails = async (lawyerIdParam: string | undefined): Promise<any> => {
            if (!lawyerIdParam) return { id: 'unknown', name: 'Unknown Lawyer', imageUrl: '', imageHint: '' };
            if (lawyerCache.has(lawyerIdParam)) return lawyerCache.get(lawyerIdParam);

            let lawyerData = { id: lawyerIdParam, name: 'Unknown Lawyer', imageUrl: '', imageHint: '' };

            try {
                const lawyerDocSnap = await db.collection('lawyerProfiles').doc(lawyerIdParam).get();
                if (lawyerDocSnap.exists) {
                    const d = lawyerDocSnap.data();
                    lawyerData = {
                        id: lawyerDocSnap.id,
                        name: d?.name || 'Unknown Lawyer',
                        imageUrl: d?.imageUrl || '',
                        imageHint: d?.imageHint || ''
                    };
                } else {
                    const userDocSnap = await db.collection('users').doc(lawyerIdParam).get();
                    if (userDocSnap.exists) {
                        const d = userDocSnap.data();
                        lawyerData = {
                            id: userDocSnap.id,
                            name: d?.name || 'Unknown Lawyer',
                            imageUrl: '',
                            imageHint: ''
                        };
                    }
                }
            } catch (err) {
                // Silently handle missing lawyer details
            }
            lawyerCache.set(lawyerIdParam, lawyerData);
            return lawyerData;
        };

        for (const d of chatDocs.values()) {
            const data = d.data();
            let lawyerId = data.lawyerId;
            if (!lawyerId && data.participants && Array.isArray(data.participants)) {
                lawyerId = data.participants.find((p: string) => p !== userId);
            }

            const lawyer = await getLawyerDetails(lawyerId);

            const lastMessageAt = data.lastMessageAt?.toDate
                ? data.lastMessageAt.toDate().toISOString()
                : new Date().toISOString();

            const updatedAt = data.lastMessageAt?.toDate
                ? data.lastMessageAt.toDate()
                : (data.createdAt?.toDate ? data.createdAt.toDate() : new Date());

            const amount = data.amount || 0;
            const isOfficial = amount > 0 || (data.installments && data.installments.length > 0);

            // Online status calculation
            const ACTIVE_THRESHOLD_MS = 120 * 1000;
            const now = Date.now();
            
            // Try to find presence info from various fields (lawyerLastSeenAt or global lastActive if we had it)
            // For now, use lawyerLastSeenAt which is updated by the heartbeat in ChatBox
            const lawyerLastSeenAt = data.lawyerLastSeenAt?.toDate()?.getTime() || 0;
            const isOnline = (now - lawyerLastSeenAt) < ACTIVE_THRESHOLD_MS;

            cases.push({
                id: d.id,
                title: data.caseTitle || '',
                status: data.status || 'active',
                lastMessage: data.lastMessage || '',
                lastMessageTimestamp: lastMessageAt,
                lawyer: lawyer,
                updatedAt: updatedAt,
                rejectReason: data.rejectReason || '',
                amount: amount,
                isOfficial: isOfficial,
                hasNewMessage: data.hasNewMessage || false,
                clientReadStatus: data.clientReadStatus || 'read',
                isWaitingVerification: data.status === 'pending_payment' && !!data.paymentSlipUrl,
                isOnline: isOnline
            });
        }

        cases.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

        // 2. Fetch Appointments
        const appointmentsRef = db.collection('appointments');
        const aptSnap = await appointmentsRef.where('userId', '==', userId).get();

        const appointments: UpcomingAppointment[] = [];
        for (const d of aptSnap.docs) {
            const data = d.data();
            const lawyer = await getLawyerDetails(data.lawyerId);

            const date = data.date?.toDate ? data.date.toDate() : new Date();
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            if (date >= todayStart) {
                appointments.push({
                    id: d.id,
                    date: date,
                    time: data.timeSlot || 'N/A',
                    description: data.description || '',
                    lawyer: { id: lawyer.id, name: lawyer.name, imageUrl: lawyer.imageUrl, imageHint: lawyer.imageHint },
                    status: data.status || 'pending'
                });
            }
        }

        // 3. Fetch Tickets
        const ticketsRef = db.collection('tickets');
        const ticketSnap = await ticketsRef.where('userId', '==', userId).get();

        const tickets: ReportedTicket[] = ticketSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                caseId: data.caseId || '',
                lawyerId: data.lawyerId || '',
                caseTitle: data.caseTitle || '',
                problemType: data.problemType || '',
                status: data.status || 'pending',
                reportedAt: data.reportedAt?.toDate ? data.reportedAt.toDate() : new Date(),
            };
        });

        // 4. Fetch Cap Deals (Contracts)
        const contractsRef = db.collection('contracts');
        const contractSnap = await contractsRef.where('userId', '==', userId).get();

        const capDeals = contractSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
            };
        });
        capDeals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // 5. Fetch Book Orders
        const bookOrdersRef = db.collection('bookOrders');
        const bookOrderSnap = await bookOrdersRef
            .where('userId', '==', userId)
            .get();

        const bookOrders = bookOrderSnap.docs
            .map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
                };
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);

        // 6. Fetch Invoices (Billing)
        const invoicesRef = db.collection('invoices');
        const invoiceSnap = await invoicesRef
            .where('userId', '==', userId)
            .get();

        const invoices = invoiceSnap.docs
            .map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                    dueDate: data.dueDate?.toDate ? data.dueDate.toDate().toISOString() : (data.dueDate || new Date().toISOString()),
                };
            })
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);

        return { cases, appointments, tickets, capDeals, bookOrders, invoices };
    } catch (error) {
        throw new Error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    }
}

export async function getBookOrders(userId: string, limitCount: number = 50) {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        const bookOrdersRef = db.collection('bookOrders');
        const bookOrderSnap = await bookOrdersRef
            .where('userId', '==', userId)
            .get();

        const bookOrders = bookOrderSnap.docs
            .map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
                };
            })
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, limitCount);

        return bookOrders;
    } catch (error) {
        console.error("Error fetching book orders server-side:", error);
        throw new Error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    }
}

export async function getLawyerStatsAction(lawyerId: string) {
    const adminApp = await initAdmin();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized.');
    }
    const db = adminApp.firestore();

    try {
        const [appointmentsSnap, chatsSnap, reviewsSnap] = await Promise.all([
            db.collection('appointments')
                .where('lawyerId', '==', lawyerId)
                .where('status', '==', 'completed')
                .get(),
            db.collection('chats')
                .where('participants', 'array-contains', lawyerId)
                .get(),
            db.collection('reviews')
                .where('lawyerId', '==', lawyerId)
                .get()
        ]);

        let incomeThisMonth = 0;
        let totalIncome = 0;
        let completedCases = 0;
        let rating = 0;
        let responseRate = 0;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        appointmentsSnap.docs.forEach(doc => {
            const data = doc.data();
            const amount = 3500; // Fixed price logic from original
            const lawyerShare = amount * 0.85;
            totalIncome += lawyerShare;

            const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
            if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
                incomeThisMonth += lawyerShare;
            }
            completedCases++;
        });

        chatsSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.status === 'closed') {
                const amount = 500; // Fixed price logic from original
                const lawyerShare = amount * 0.85;
                totalIncome += lawyerShare;

                const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
                if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
                    incomeThisMonth += lawyerShare;
                }
                completedCases++;
            }
        });

        if (!reviewsSnap.empty) {
            const totalRating = reviewsSnap.docs.reduce((acc, doc) => acc + (doc.data()?.rating || 0), 0);
            rating = totalRating / reviewsSnap.size;
        }

        if (!chatsSnap.empty) {
            const relevantChats = chatsSnap.docs.filter(doc => {
                const data = doc.data();
                return data.status !== 'pending_payment';
            });
            const engagedChats = relevantChats.filter(doc => {
                const data = doc.data();
                return data.status === 'active' || data.status === 'closed';
            }).length;

            if (relevantChats.length > 0) {
                responseRate = (engagedChats / relevantChats.length) * 100;
            } else {
                responseRate = 100;
            }
        } else {
            responseRate = 100;
        }

        return JSON.parse(JSON.stringify({
            incomeThisMonth: Number(incomeThisMonth) || 0,
            totalIncome: Number(totalIncome) || 0,
            completedCases: Number(completedCases) || 0,
            rating: Number(rating) || 4.8,
            responseRate: Number(responseRate) || 95
        }));
    } catch (error) {
        console.error("Error calculating lawyer stats action:", error);
        return {
            incomeThisMonth: 0,
            totalIncome: 0,
            completedCases: 0,
            rating: 4.8, // Fallback
            responseRate: 95 // Fallback
        };
    }
}

export async function getLawyerDashboardDataAction(lawyerId: string): Promise<{ newRequests: LawyerAppointmentRequest[], activeCases: LawyerCase[], completedCases: LawyerCase[] }> {
    const adminApp = await initAdmin();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized.');
    }
    const db = adminApp.firestore();

    try {
        // 1. Fetch appointments and chats
        const requestsSnap = await db.collection('appointments')
            .where('lawyerId', '==', lawyerId)
            .where('status', '==', 'pending')
            .limit(50)
            .get();

        const casesSnap = await db.collection('chats')
            .where('participants', 'array-contains', lawyerId)
            .limit(100)
            .get();

        const initialChatDocs = casesSnap.docs;
        const allChatDocs = [...initialChatDocs];

        // 1.5 Fallback: Find chats where this user is the assigned lawyer (via profile ID) 
        // but their UID isn't in participants yet.
        const lawyerProfiles = await db.collection('lawyerProfiles').where('userId', '==', lawyerId).get();
        if (!lawyerProfiles.empty) {
            const profileIds = lawyerProfiles.docs.map(d => d.id);
            // Query for chats where lawyerId is one of these profiles
            const orphanSnap = await db.collection('chats')
                .where('lawyerId', 'in', profileIds)
                .limit(50)
                .get();
            
            orphanSnap.docs.forEach(doc => {
                if (!allChatDocs.some(existing => existing.id === doc.id)) {
                    allChatDocs.push(doc);
                }
            });
        }

        // 2. Fetch user profiles in batch
        const userIds = new Set<string>();
        requestsSnap.docs.forEach(d => { if (d.get('userId')) userIds.add(d.get('userId')); });
        allChatDocs.forEach(d => {
            const participants = d.get('participants') || [];
            const clientParticipantId = participants.find((p: string) => p !== lawyerId) || d.get('clientId') || d.get('userId');
            if (clientParticipantId) userIds.add(clientParticipantId);
        });

        const userProfiles: Record<string, any> = {};
        if (userIds.size > 0) {
            const idsArray = Array.from(userIds);
            const chunks = [];
            for (let i = 0; i < idsArray.length; i += 30) {
                chunks.push(idsArray.slice(i, i + 30));
            }
            const userSnaps = await Promise.all(chunks.map(chunk =>
                db.collection('users').where('__name__', 'in', chunk).get()
            ));
            userSnaps.forEach(snap => {
                snap.docs.forEach(doc => { userProfiles[doc.id] = doc.data(); });
            });
        }

        // 3. Map results
        const newRequests: LawyerAppointmentRequest[] = requestsSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                clientName: userProfiles[data.userId]?.name || 'ลูกความ',
                userId: data.userId || '',
                caseTitle: data.description,
                description: data.description,
                requestedAt: data.createdAt?.toDate() || new Date(),
            };
        });

        const lawyerCases = allChatDocs.map(d => {
            const chatData = d.data();
            const clientParticipantId = (chatData.participants || []).find((p: string) => p !== lawyerId) || chatData.clientId || chatData.userId;

            const lastMessageAt = chatData.lastMessageAt?.toDate() || chatData.createdAt?.toDate() || new Date(0);
            const lawyerReadAt = chatData.lawyerReadAt?.toDate() || new Date(0);
            const isUnread = lastMessageAt > lawyerReadAt;

            const amount = chatData.amount || 0;
            const isOfficial = amount > 0 || (chatData.installments && chatData.installments.length > 0);

            // Online status calculation
            const ACTIVE_THRESHOLD_MS = 120 * 1000;
            const now = Date.now();
            
            // Check global presence from users collection first (best for "on website")
            const globalLastActiveAt = userProfiles[clientParticipantId]?.lastActive?.toDate()?.getTime() || 0;
            // Fallback to chat-specific presence
            const chatLastSeenAt = chatData.clientLastSeenAt?.toDate()?.getTime() || 0;
            
            const lastSeenAt = Math.max(globalLastActiveAt, chatLastSeenAt);
            const isOnline = (now - lastSeenAt) < ACTIVE_THRESHOLD_MS;

            return {
                id: d.id,
                title: chatData.caseTitle || 'Unknown Case',
                clientName: userProfiles[clientParticipantId]?.name || 'ลูกความ',
                clientId: clientParticipantId,
                status: chatData.status,
                lastUpdate: lastMessageAt.toLocaleDateString('th-TH') || 'N/A',
                updatedAt: lastMessageAt,
                notifications: isUnread ? 1 : 0,
                lastMessage: chatData.lastMessage || '',
                amount: amount,
                isOfficial: isOfficial,
                isWaitingVerification: chatData.status === 'pending_payment' && !!chatData.paymentSlipUrl,
                clientImageUrl: userProfiles[clientParticipantId]?.avatar || userProfiles[clientParticipantId]?.imageUrl || '',
                isOnline: isOnline
            };
        });

        return JSON.parse(JSON.stringify({
            newRequests,
            activeCases: lawyerCases
                .filter(c => c.status === 'active' || c.status === 'pending_payment')
                .sort((a: any, b: any) => b.updatedAt.getTime() - a.updatedAt.getTime()) as LawyerCase[],
            completedCases: lawyerCases
                .filter(c => c.status === 'closed')
                .sort((a: any, b: any) => b.updatedAt.getTime() - a.updatedAt.getTime()) as LawyerCase[],
        }));
    } catch (error) {
        console.error("Error fetching lawyer dashboard action:", error);
        return { newRequests: [], activeCases: [], completedCases: [] };
    }
}

export async function getAdminLawyerDashboardDataAction(): Promise<{ newRequests: LawyerAppointmentRequest[], activeCases: LawyerCase[], completedCases: LawyerCase[] }> {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        const [requestsSnap, casesSnap] = await Promise.all([
            db.collection('appointments')
                .where('status', '==', 'pending')
                .limit(100)
                .get(),
            db.collection('chats')
                .orderBy('createdAt', 'desc')
                .limit(500) 
                .get()
        ]);

        const userIds = new Set<string>();
        requestsSnap.docs.forEach(d => { if (d.get('userId')) userIds.add(d.get('userId')); });
        casesSnap.docs.forEach(d => {
            const participants = d.get('participants') || [];
            participants.forEach((p: string) => userIds.add(p));
            // Ensure clientId and userId are also included as fallbacks
            if (d.get('clientId')) userIds.add(d.get('clientId'));
            if (d.get('userId')) userIds.add(d.get('userId'));
        });

        const userProfiles: Record<string, any> = {};
        if (userIds.size > 0) {
            const idsArray = Array.from(userIds).filter(Boolean);
            const chunks = [];
            for (let i = 0; i < idsArray.length; i += 30) {
                chunks.push(idsArray.slice(i, i + 30));
            }
            const userSnaps = await Promise.all(chunks.map(chunk =>
                db.collection('users').where('__name__', 'in', chunk).get()
            ));
            userSnaps.forEach(snap => {
                snap.docs.forEach(doc => { userProfiles[doc.id] = doc.data(); });
            });
        }

        const newRequests: LawyerAppointmentRequest[] = requestsSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                clientName: userProfiles[data.userId]?.name || 'ลูกความ',
                userId: data.userId || '',
                caseTitle: data.description,
                description: data.description,
                requestedAt: data.createdAt?.toDate() || new Date(),
            };
        });

        const lawyerCases = casesSnap.docs.map(d => {
            const chatData = d.data();
            const participants = chatData.participants || [];
            
            // Logic to find the client: they are usually NOT the lawyerId stored in the chat
            const lawyerIdInChat = chatData.lawyerId;
            const clientParticipantId = participants.find((p: string) => p !== lawyerIdInChat) || chatData.clientId || chatData.userId || '';
            
            const lastUpdateDate = chatData.lastMessageAt?.toDate() || chatData.createdAt?.toDate() || new Date();

            return {
                id: d.id,
                title: chatData.caseTitle || 'Unknown Case',
                clientName: userProfiles[clientParticipantId]?.name || 'ลูกความ',
                clientId: clientParticipantId,
                status: chatData.status,
                lastUpdate: lastUpdateDate.toLocaleDateString('th-TH') || 'N/A',
                updatedAt: lastUpdateDate,
                isOnline: (Date.now() - (userProfiles[clientParticipantId]?.lastActive?.toDate()?.getTime() || 0)) < (120 * 1000)
            };
        });

        return JSON.parse(JSON.stringify({
            newRequests,
            activeCases: lawyerCases
                .filter(c => c.status === 'active' || c.status === 'pending_payment')
                .sort((a: any, b: any) => b.updatedAt.getTime() - a.updatedAt.getTime()) as LawyerCase[],
            completedCases: lawyerCases
                .filter(c => c.status === 'closed')
                .sort((a: any, b: any) => b.updatedAt.getTime() - a.updatedAt.getTime()) as LawyerCase[],
        }));
    } catch (error) {
        console.error("Error fetching admin dashboard action:", error);
        return { newRequests: [], activeCases: [], completedCases: [] };
    }
}

export async function getLawyerFinancialsAction(lawyerId: string) {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        const appointmentsRef = db.collection('appointments');
        const chatsRef = db.collection('chats');
        const withdrawalsRef = db.collection('withdrawals');
        const lawyerRef = db.collection('lawyerProfiles').doc(lawyerId);

        const [transactionsSnapshot, withdrawSnapshot, lawyerDoc] = await Promise.all([
            db.collection('transactions').where('lawyerId', '==', lawyerId).get(),
            withdrawalsRef.where('lawyerId', '==', lawyerId).get(),
            lawyerRef.get()
        ]);

        const lawyerProfile = lawyerDoc.data();

        // Collect user IDs for batch fetching mapped to transactions
        const userIds = new Set<string>();
        transactionsSnapshot.docs.forEach(d => { if (d.get('clientId')) userIds.add(d.get('clientId')); });

        const userProfiles: Record<string, any> = {};
        if (userIds.size > 0) {
            const idsArray = Array.from(userIds);
            const chunks = [];
            for (let i = 0; i < idsArray.length; i += 30) {
                chunks.push(idsArray.slice(i, i + 30));
            }
            const userSnaps = await Promise.all(chunks.map(chunk =>
                db.collection('users').where('__name__', 'in', chunk).get()
            ));
            userSnaps.forEach(snap => {
                snap.docs.forEach(doc => { userProfiles[doc.id] = doc.data(); });
            });
        }

        const allTransactions: any[] = [];
        let total = 0;
        let pending = 0;
        let thisMonth = 0;
        const now = new Date();

        // Process Transactions
        transactionsSnapshot.docs.forEach(d => {
            const data = d.data();

            const netAmount = data.netAmount || 0;
            const isCompleted = data.status === 'completed';

            const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
            if (isCompleted) {
                total += netAmount;
                if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
                    thisMonth += netAmount;
                }
            } else {
                pending += netAmount;
            }

            // Derive description from id (e.g. "apt_xxx" -> "นัดหมายปรึกษา", "chat_xxx" -> "ปรึกษาผ่านแชท")
            let description = 'ทำรายการ';
            if (d.id.startsWith('apt_')) description = 'นัดหมายปรึกษา';
            else if (d.id.startsWith('chat_')) description = 'ปรึกษาผ่านแชท';

            allTransactions.push({
                id: d.id,
                date: date.toISOString(),
                description: description,
                amount: netAmount, // Dashboard uses amount strictly to display revenue
                type: data.type || 'revenue',
                status: isCompleted ? 'completed' : 'pending',
                clientName: userProfiles[data.clientId]?.name || 'ลูกความ',
                rawDateValue: date.getTime()
            });
        });

        const withdrawals: any[] = [];
        let totalWithdrawn = 0;
        let pendingWithdrawal = 0;

        withdrawSnapshot.docs.forEach(doc => {
            const data = doc.data();
            withdrawals.push({
                id: doc.id,
                amount: data.amount,
                status: data.status,
                requestedAt: data.requestedAt?.toDate ? data.requestedAt.toDate().toISOString() : new Date().toISOString(),
                bankName: data.bankName,
                accountNumber: data.accountNumber,
                rawDateValue: data.requestedAt?.toDate ? data.requestedAt.toDate().getTime() : 0
            });

            if (data.status === 'approved') {
                totalWithdrawn += data.amount;
            } else if (data.status === 'pending') {
                pendingWithdrawal += data.amount;
            }
        });

        allTransactions.sort((a, b) => b.rawDateValue - a.rawDateValue);
        withdrawals.sort((a, b) => b.rawDateValue - a.rawDateValue);

        return JSON.parse(JSON.stringify({
            transactions: allTransactions,
            withdrawals: withdrawals,
            stats: {
                totalIncome: total,
                pendingIncome: pending,
                incomeThisMonth: thisMonth,
                withdrawnAmount: totalWithdrawn,
                availableBalance: total - totalWithdrawn - pendingWithdrawal
            },
            profile: {
                bankName: lawyerProfile?.bankName || '',
                bankAccountNumber: lawyerProfile?.bankAccountNumber || '',
                bankAccountName: lawyerProfile?.bankAccountName || lawyerProfile?.name || '',
                name: lawyerProfile?.name || '',
                corporateName: lawyerProfile?.corporateName || '',
                corporateTaxId: lawyerProfile?.corporateTaxId || '',
                corporateAddress: lawyerProfile?.corporateAddress || ''
            }
        }));

    } catch (error) {
        console.error("Error fetching lawyer financials action:", error);
        throw new Error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    }
}
