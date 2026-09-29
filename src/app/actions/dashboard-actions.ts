'use server';

import { initAdmin } from '@/lib/firebase-admin';
import type { Case, UpcomingAppointment, ReportedTicket, LawyerCase, LawyerAppointmentRequest } from '@/lib/types';
import { requireUser, requireAdmin, requireLawyer, AuthError } from '@/lib/auth-guard';
import { summarizeLawyerReceipts } from '@/lib/lawyer-receipts';

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
        // ห้องแชทเก็บทนายไว้หลายแบบ: lawyerId (id โปรไฟล์), lawyer_id (รุ่นเก่า) หรือไม่มีเลย
        // มีแค่ uid ทนายใน participants — id โปรไฟล์ที่แอดมินสร้างเป็น id สุ่ม ไม่เท่ากับ uid
        // เดิมเช็คแค่ lawyerId แล้วหา lawyerProfiles ด้วย doc id อย่างเดียว → "Unknown Lawyer"
        const resolveLawyerId = (data: FirebaseFirestore.DocumentData): string | undefined => {
            let lawyerId = data.lawyerId || data.lawyer_id;
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

        const chunk30 = (ids: string[]) => {
            const out: string[][] = [];
            for (let i = 0; i < ids.length; i += 30) out.push(ids.slice(i, i + 30));
            return out;
        };

        const DEFAULT_LAWYER = { name: 'Unknown Lawyer', imageUrl: '', imageHint: '' };
        type LawyerInfo = { name: string; imageUrl: string; imageHint: string; ownerUid?: string };
        const lawyerProfileMap: Record<string, LawyerInfo> = {};
        const fromProfile = (d: FirebaseFirestore.DocumentData): LawyerInfo => ({
            name: d?.name || 'Unknown Lawyer', imageUrl: d?.imageUrl || '', imageHint: d?.imageHint || '', ownerUid: d?.userId,
        });
        if (lawyerIds.size > 0) {
            const idsArray = Array.from(lawyerIds);

            // 1) id เป็น id ของ lawyerProfiles
            const profileSnaps = await Promise.all(chunk30(idsArray).map(chunk =>
                db.collection('lawyerProfiles').where('__name__', 'in', chunk).get()
            ));
            profileSnaps.forEach(snap => snap.docs.forEach(doc => {
                lawyerProfileMap[doc.id] = fromProfile(doc.data());
            }));

            // 2) id เป็น uid ของทนาย → หาโปรไฟล์ที่ userId ตรงกัน
            let missingIds = idsArray.filter(id => !lawyerProfileMap[id]);
            if (missingIds.length > 0) {
                const byOwnerSnaps = await Promise.all(chunk30(missingIds).map(chunk =>
                    db.collection('lawyerProfiles').where('userId', 'in', chunk).get()
                ));
                byOwnerSnaps.forEach(snap => snap.docs.forEach(doc => {
                    const owner = doc.data()?.userId;
                    if (owner && !lawyerProfileMap[owner]) lawyerProfileMap[owner] = fromProfile(doc.data());
                }));
            }

            // 3) ไม่มีโปรไฟล์ทนายเลย → ใช้ชื่อจาก users
            missingIds = idsArray.filter(id => !lawyerProfileMap[id]);
            if (missingIds.length > 0) {
                const userSnaps = await Promise.all(chunk30(missingIds).map(chunk =>
                    db.collection('users').where('__name__', 'in', chunk).get()
                ));
                userSnaps.forEach(snap => snap.docs.forEach(doc => {
                    const d = doc.data();
                    lawyerProfileMap[doc.id] = {
                        name: d?.name || d?.displayName || 'Unknown Lawyer',
                        imageUrl: d?.avatar || d?.imageUrl || '',
                        imageHint: '',
                        ownerUid: doc.id,
                    };
                }));
            }
        }

        const getLawyerDetails = (lawyerIdParam: string | undefined): any => {
            if (!lawyerIdParam) return { id: 'unknown', ...DEFAULT_LAWYER };
            const { ownerUid: _ownerUid, ...info } = lawyerProfileMap[lawyerIdParam] || DEFAULT_LAWYER;
            return { id: lawyerIdParam, ...info };
        };

        // ห้องที่ผู้ใช้เป็น "ทนาย" เอง (ทนายเปิดแดชบอร์ดลูกความ) อยู่ในแดชบอร์ดทนายแล้ว
        // เดิมโผล่ที่นี่ด้วย โดยเอาชื่อลูกความมาแสดงเป็นชื่อทนาย
        const isOwnLawyerChat = (data: FirebaseFirestore.DocumentData): boolean => {
            const id = data.lawyerId || data.lawyer_id;
            if (!id) return false;
            return id === userId || lawyerProfileMap[id]?.ownerUid === userId;
        };

        const cases: Case[] = [];
        // ส่งให้หน้าเว็บรู้ว่าห้องไหนตั้งใจไม่แสดง — ไม่งั้น realtime listener เห็นว่าเป็นห้องใหม่
        // แล้วดึงข้อมูลทั้งหมดใหม่ทุกข้อความ
        const excludedChatIds: string[] = [];

        for (const d of chatDocs.values()) {
            const data = d.data();
            if (isOwnLawyerChat(data)) { excludedChatIds.push(d.id); continue; }
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

            if (date >= todayStart && data.status !== 'cancelled') {
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
        // ใบแจ้งหนี้มีชื่อช่อง 2 ชุด (userId/dueDate จากแชท, client_id/due_date จากหน้า billing
        // ของทนาย) — เดิมค้นแค่ userId การ์ดนี้กับหน้า billing จึงเห็นใบแจ้งหนี้คนละชุด
        const invoicesRef = db.collection('invoices');
        const [invByUserId, invByClientId] = await Promise.all([
            invoicesRef.where('userId', '==', userId).limit(200).get(),
            invoicesRef.where('client_id', '==', userId).limit(200).get(),
        ]);
        const invoiceDocs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
        [...invByUserId.docs, ...invByClientId.docs].forEach(d => invoiceDocs.set(d.id, d));

        const toIso = (v: any): string | null => {
            if (!v) return null;
            const date = v.toDate ? v.toDate() : new Date(v);
            return isNaN(date.getTime()) ? null : date.toISOString();
        };

        const invoices = Array.from(invoiceDocs.values())
            .map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    chatId: data.chatId || data.case_id || data.caseId || data.chat_id || null,
                    createdAt: toIso(data.createdAt) || new Date().toISOString(),
                    dueDate: toIso(data.dueDate ?? data.due_date),
                    paidAt: toIso(data.paidAt),
                    updatedAt: toIso(data.updatedAt),
                };
            })
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);

        return { cases, appointments, tickets, capDeals, invoices, excludedChatIds };
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

        let completedCases = 0;
        let rating = 0;
        let responseRate = 0;

        // เดิมรายได้เป็นตัวเลขสมมติ (นัดหมาย 3,500 × 85% / แชทปิด 500 × 85% = หัก GP 15%)
        // ตอนนี้ไม่มี GP และแพลตฟอร์มไม่ถือเงิน → รายได้ = ยอดที่ทนายกดยืนยันรับเอง (lib/lawyer-receipts)
        const { totalReceived: totalIncome, receivedThisMonth: incomeThisMonth } =
            summarizeLawyerReceipts(chatsSnap.docs.map(d => ({ id: d.id, data: d.data() })));

        completedCases += appointmentsSnap.size;
        chatsSnap.docs.forEach(doc => {
            if (doc.data().status === 'closed') completedCases++;
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
    // appointments.lawyerId เก็บ id ของ lawyerProfiles (respondToAppointmentRequestAction
    // เทียบกับ lawyerProfileId) ซึ่งไม่เท่ากับ uid เสมอไป — โปรไฟล์ที่แอดมินสร้างด้วย addDoc
    // ได้ doc id สุ่ม ส่วน chats.participants เก็บ uid
    const { uid: lawyerId, lawyerProfileId } = await requireLawyer();
    const adminApp = await initAdmin();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized.');
    }
    const db = adminApp.firestore();

    try {
        // 1. Fetch appointments and chats
        const requestsSnap = await db.collection('appointments')
            .where('lawyerId', '==', lawyerProfileId)
            // คำขอนัดหมายฟรีที่รอตอบรับ (requestAppointmentAction สร้างที่ 'pending')
            // คำขอรุ่นเก่าที่ค้าง 'paid' (จ่ายผ่านแพลตฟอร์มแล้วแต่ยังไม่มีคนรับ) ก็ต้องขึ้นให้เห็นด้วย
            .where('status', 'in', ['pending', 'paid'])
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


/**
 * หน้าการเงินของทนาย — บัญชีรับเงิน + บันทึกยอดที่ทนายยืนยันรับเอง
 *
 * เดิมคำนวณ "ยอดคงเหลือที่ถอนได้" จาก transactions (หลังหัก GP) − withdrawals เพราะแพลตฟอร์ม
 * ถือเงินไว้ให้ ตอนนี้ลูกความโอนเข้าบัญชีทนายโดยตรง ไม่มียอดคงเหลือ/การถอน/GP อีกแล้ว
 * (transactions / withdrawals ไม่ถูกอ่านหรือเขียนจากเว็บหลักแล้ว — ดู LAWSLANE-PLAN-05)
 */
export async function getLawyerFinancialsAction() {
    // uid จาก session · โปรไฟล์จาก requireLawyer (doc id ของโปรไฟล์ไม่จำเป็นต้องเท่ากับ uid)
    const { uid, lawyerProfileId, adminApp } = await requireLawyer();
    const db = adminApp.firestore();

    try {
        const [lawyerDoc, byProfile, byParticipant] = await Promise.all([
            db.collection('lawyerProfiles').doc(lawyerProfileId).get(),
            db.collection('chats').where('lawyerId', '==', lawyerProfileId).limit(500).get(),
            db.collection('chats').where('participants', 'array-contains', uid).limit(500).get(),
        ]);

        // ห้องที่ผู้เรียกเป็นทนายจริง (lawyerId = โปรไฟล์ของผู้เรียก) — participants อย่างเดียวไม่พอ
        // เพราะทนายอาจเป็นลูกความในห้องอื่นได้
        const chats = new Map<string, FirebaseFirestore.DocumentData>();
        for (const d of [...byProfile.docs, ...byParticipant.docs]) {
            const data = d.data();
            if ((data.lawyerId || data.lawyer_id) === lawyerProfileId) chats.set(d.id, data);
        }

        const summary = summarizeLawyerReceipts([...chats].map(([id, data]) => ({ id, data })));

        const clientIds = [...new Set(summary.receipts.map(r => r.clientId).filter(Boolean))];
        const clientNames: Record<string, string> = {};
        for (let i = 0; i < clientIds.length; i += 30) {
            const snap = await db.collection('users').where('__name__', 'in', clientIds.slice(i, i + 30)).get();
            snap.docs.forEach(doc => { clientNames[doc.id] = doc.data()?.name || 'ลูกความ'; });
        }

        const lawyerProfile = lawyerDoc.data();

        return JSON.parse(JSON.stringify({
            receipts: summary.receipts.map(r => ({
                ...r,
                clientName: clientNames[r.clientId] || 'ลูกความ',
            })),
            stats: {
                totalReceived: summary.totalReceived,
                receivedThisMonth: summary.receivedThisMonth,
                outstanding: summary.outstanding,
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
