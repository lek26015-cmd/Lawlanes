'use server';

import { initAdmin } from '@/lib/firebase-admin';
import type { Case, UpcomingAppointment, ReportedTicket, LawyerCase, LawyerAppointmentRequest } from '@/lib/types';
import { requireUser, requireAdmin, AuthError } from '@/lib/auth-guard';
import { reduceLawyerBalance } from '@/lib/lawyer-balance';

/** ผู้เรียกเป็นทนายคนนี้เองหรือเป็นแอดมินหรือไม่ (lawyerId เป็น id ของ lawyerProfiles) */
async function callerIsThisLawyerOrAdmin(lawyerId: string): Promise<boolean> {
    try {
        const { uid, token, adminApp } = await requireUser();
        if (token.admin === true || token.role === 'admin') return true;
        if (uid === lawyerId) return true;
        const snap = await adminApp.firestore().collection('lawyerProfiles').doc(lawyerId).get();
        return snap.exists && snap.data()?.userId === uid;
    } catch {
        return false;
    }
}

export async function getUserDashboardData() {
    // uid มาจาก session — เดิมรับ userId เป็น argument จึงดู dashboard ของคนอื่นได้
    const { uid: userId, adminApp } = await requireUser();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized. Please check environment variables.');
    }
    const db = adminApp.firestore();

    try {
        // 1. Fetch Cases (Chats)
        const chatsRef = db.collection('chats');

        // Query by participants
        const q1 = chatsRef.where('participants', 'array-contains', userId).limit(200).get();
        const q2 = chatsRef.where('userId', '==', userId).limit(200).get();

        const [pSnap, uSnap] = await Promise.all([q1, q2]);

        const chatDocs = new Map();
        pSnap.docs.forEach(d => chatDocs.set(d.id, d));
        uSnap.docs.forEach(d => chatDocs.set(d.id, d));

        // Resolve each chat's lawyer id up front so lawyer profiles can be
        // batch-fetched below instead of one Firestore read per chat/appointment
        // (see LAWSLANE-PLAN-01 2.2).
        const resolveLawyerId = (data: FirebaseFirestore.DocumentData): string | undefined => {
            let lawyerId = data.lawyerId;
            if (!lawyerId && data.participants && Array.isArray(data.participants)) {
                lawyerId = data.participants.find((p: string) => p !== userId);
            }
            return lawyerId;
        };

        // 2. Fetch Appointments (queried early so its lawyerIds join the same batch)
        const appointmentsRef = db.collection('appointments');
        const aptSnap = await appointmentsRef.where('userId', '==', userId).limit(200).get();

        const lawyerIds = new Set<string>();
        for (const d of chatDocs.values()) {
            const id = resolveLawyerId(d.data());
            if (id) lawyerIds.add(id);
        }
        for (const d of aptSnap.docs) {
            const id = d.data().lawyerId;
            if (id) lawyerIds.add(id);
        }

        const DEFAULT_LAWYER = { name: 'Unknown Lawyer', imageUrl: '', imageHint: '' };
        const lawyerProfileMap: Record<string, { name: string; imageUrl: string; imageHint: string }> = {};
        if (lawyerIds.size > 0) {
            const idsArray = Array.from(lawyerIds);
            const chunks: string[][] = [];
            for (let i = 0; i < idsArray.length; i += 30) {
                chunks.push(idsArray.slice(i, i + 30));
            }

            // Try lawyerProfiles first...
            const profileSnaps = await Promise.all(chunks.map(chunk =>
                db.collection('lawyerProfiles').where('__name__', 'in', chunk).get()
            ));
            profileSnaps.forEach(snap => snap.docs.forEach(doc => {
                const d = doc.data();
                lawyerProfileMap[doc.id] = { name: d?.name || 'Unknown Lawyer', imageUrl: d?.imageUrl || '', imageHint: d?.imageHint || '' };
            }));

            // ...then fall back to users for any id not found there.
            const missingIds = idsArray.filter(id => !lawyerProfileMap[id]);
            if (missingIds.length > 0) {
                const missingChunks: string[][] = [];
                for (let i = 0; i < missingIds.length; i += 30) {
                    missingChunks.push(missingIds.slice(i, i + 30));
                }
                const userSnaps = await Promise.all(missingChunks.map(chunk =>
                    db.collection('users').where('__name__', 'in', chunk).get()
                ));
                userSnaps.forEach(snap => snap.docs.forEach(doc => {
                    const d = doc.data();
                    lawyerProfileMap[doc.id] = { name: d?.name || 'Unknown Lawyer', imageUrl: '', imageHint: '' };
                }));
            }
        }

        const getLawyerDetails = (lawyerIdParam: string | undefined): any => {
            if (!lawyerIdParam) return { id: 'unknown', ...DEFAULT_LAWYER };
            return { id: lawyerIdParam, ...(lawyerProfileMap[lawyerIdParam] || DEFAULT_LAWYER) };
        };

        const cases: Case[] = [];

        for (const d of chatDocs.values()) {
            const data = d.data();
            const lawyerId = resolveLawyerId(data);

            const lawyer = getLawyerDetails(lawyerId);

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

        // 2. Map Appointments (fetched above, alongside chats, to build the lawyer id batch)
        const appointments: UpcomingAppointment[] = [];
        for (const d of aptSnap.docs) {
            const data = d.data();
            const lawyer = getLawyerDetails(data.lawyerId);

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
        const ticketSnap = await ticketsRef.where('userId', '==', userId).limit(200).get();

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
        const contractSnap = await contractsRef.where('userId', '==', userId).limit(200).get();

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

        // 5. Fetch Invoices (Billing)
        // Bounded to 200 then sorted+sliced in JS below — an indexed orderBy() would let
        // Firestore do this directly, but that needs a (userId + createdAt) composite index
        // that doesn't exist yet; adding orderBy() without it would make this query fail outright.
        const invoicesRef = db.collection('invoices');
        const invoiceSnap = await invoicesRef
            .where('userId', '==', userId)
            .limit(200)
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

        return { cases, appointments, tickets, capDeals, invoices };
    } catch (error) {
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

        // หน้าโปรไฟล์ทนายเป็นหน้าสาธารณะ และเรียก action นี้ด้วย lawyerId ใดก็ได้
        // → ตัวเลขรายได้ต้องไม่หลุดออกไป เปิดเฉพาะเจ้าตัวกับแอดมิน
        const canSeeFinancials = await callerIsThisLawyerOrAdmin(lawyerId);

        return JSON.parse(JSON.stringify({
            incomeThisMonth: canSeeFinancials ? (Number(incomeThisMonth) || 0) : 0,
            totalIncome: canSeeFinancials ? (Number(totalIncome) || 0) : 0,
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

export async function getLawyerDashboardDataAction(): Promise<{ newRequests: LawyerAppointmentRequest[], activeCases: LawyerCase[], completedCases: LawyerCase[] }> {
    // uid มาจาก session — เดิมรับ lawyerId เป็น argument
    const { uid: lawyerId } = await requireUser();
    const adminApp = await initAdmin();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized.');
    }
    const db = adminApp.firestore();

    try {
        // 1. Fetch appointments and chats
        const requestsSnap = await db.collection('appointments')
            .where('lawyerId', '==', lawyerId)
            // คำขอที่ทนายรับได้คือนัดที่ "จ่ายแล้ว" เท่านั้น (respondToAppointmentRequestAction
            // ยอมรับเฉพาะ status 'paid') — เดิมดึง 'pending' ซึ่ง createAppointment ไม่เคย
            // สร้าง คำขอที่ลูกความจ่ายแล้วจึงไม่เคยขึ้นให้ทนายเห็น
            .where('status', '==', 'paid')
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


export async function getLawyerFinancialsAction() {
    // ข้อมูลการเงินของทนาย — uid มาจาก session เท่านั้น
    const { uid: lawyerId } = await requireUser();
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
        let thisMonth = 0;
        const now = new Date();

        // Process Transactions
        transactionsSnapshot.docs.forEach(d => {
            const data = d.data();

            const netAmount = data.netAmount || 0;
            const isCompleted = data.status === 'completed';

            const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
            if (isCompleted && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
                thisMonth += netAmount;
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

        // ยอดรวมทั้งหมดคิดด้วยสูตรกลาง (lib/lawyer-balance) ตัวเดียวกับที่ด่านขอถอน
        // และหน้าอนุมัติของแอดมินใช้ — ห้ามคิดซ้ำเองตรงนี้ ไม่งั้นตัวเลขจะเพี้ยนกันได้
        const balance = reduceLawyerBalance(transactionsSnapshot.docs, withdrawSnapshot.docs);

        const withdrawals: any[] = [];

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
        });

        allTransactions.sort((a, b) => b.rawDateValue - a.rawDateValue);
        withdrawals.sort((a, b) => b.rawDateValue - a.rawDateValue);

        return JSON.parse(JSON.stringify({
            transactions: allTransactions,
            withdrawals: withdrawals,
            stats: {
                totalIncome: balance.totalIncome,
                pendingIncome: balance.pendingIncome,
                incomeThisMonth: thisMonth,
                withdrawnAmount: balance.withdrawnAmount,
                availableBalance: balance.availableBalance
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
