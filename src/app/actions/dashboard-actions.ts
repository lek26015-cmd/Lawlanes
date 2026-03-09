'use server';

import { initAdmin } from '@/lib/firebase-admin';
import type { Case, UpcomingAppointment, ReportedTicket } from '@/lib/types';

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

            cases.push({
                id: d.id,
                title: data.caseTitle || '',
                status: data.status || 'active',
                lastMessage: data.lastMessage || '',
                lastMessageTimestamp: lastMessageAt,
                lawyer: lawyer,
                updatedAt: updatedAt,
                rejectReason: data.rejectReason || '',
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
                    lawyer: { name: lawyer.name, imageUrl: lawyer.imageUrl, imageHint: lawyer.imageHint },
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

        return { cases, appointments, tickets, capDeals };
    } catch (error) {
        throw error;
    }
}
