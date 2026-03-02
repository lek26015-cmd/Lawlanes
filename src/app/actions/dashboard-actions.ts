'use server';

import { initializeFirebase } from '@/firebase';
import { collection, getDocs, query, where, doc, getDoc, Timestamp, orderBy } from 'firebase/firestore';
import type { Case, UpcomingAppointment, ReportedTicket } from '@/lib/types';

export async function getUserDashboardData(userId: string) {
    const { firestore: db } = initializeFirebase();
    if (!db) {
        throw new Error('Firebase Firestore not initialized');
    }

    // 1. Fetch Cases (Chats)
    const chatsRef = collection(db, 'chats');

    // Query by participants
    const q1 = query(chatsRef, where('participants', 'array-contains', userId));
    const q2 = query(chatsRef, where('userId', '==', userId));

    const [pSnap, uSnap] = await Promise.all([getDocs(q1), getDocs(q2)]);

    const chatDocs = new Map();
    pSnap.docs.forEach(d => chatDocs.set(d.id, d));
    uSnap.docs.forEach(d => chatDocs.set(d.id, d));

    const cases: Case[] = [];
    const lawyerCache = new Map();

    const getLawyerDetails = async (lawyerIdParam: string | undefined): Promise<any> => {
        if (!lawyerIdParam) return { id: 'unknown', name: 'Unknown Lawyer', imageUrl: '', imageHint: '' };
        if (lawyerCache.has(lawyerIdParam)) return lawyerCache.get(lawyerIdParam);

        let lawyerData = { id: lawyerIdParam, name: 'Unknown Lawyer', imageUrl: '', imageHint: '' };

        const lawyerDocSnap = await getDoc(doc(db, 'lawyerProfiles', lawyerIdParam));
        if (lawyerDocSnap.exists()) {
            const d = lawyerDocSnap.data();
            lawyerData = {
                id: lawyerDocSnap.id,
                name: d?.name || 'Unknown Lawyer',
                imageUrl: d?.imageUrl || '',
                imageHint: d?.imageHint || ''
            };
        } else {
            const userDocSnap = await getDoc(doc(db, 'users', lawyerIdParam));
            if (userDocSnap.exists()) {
                const d = userDocSnap.data();
                lawyerData = {
                    id: userDocSnap.id,
                    name: d?.name || 'Unknown Lawyer',
                    imageUrl: '',
                    imageHint: ''
                };
            }
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

        const lastMessageAt = data.lastMessageAt instanceof Timestamp
            ? data.lastMessageAt.toDate().toISOString()
            : new Date().toISOString();

        const updatedAt = data.lastMessageAt instanceof Timestamp
            ? data.lastMessageAt.toDate()
            : (data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date());

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
    const appointmentsRef = collection(db, 'appointments');
    const aptSnap = await getDocs(query(appointmentsRef, where('userId', '==', userId)));

    const appointments: UpcomingAppointment[] = [];
    for (const d of aptSnap.docs) {
        const data = d.data();
        const lawyer = await getLawyerDetails(data.lawyerId);

        const date = data.date instanceof Timestamp ? data.date.toDate() : new Date();
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
    const ticketsRef = collection(db, 'tickets');
    const ticketSnap = await getDocs(query(ticketsRef, where('userId', '==', userId)));

    const tickets: ReportedTicket[] = ticketSnap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            caseId: data.caseId || '',
            lawyerId: data.lawyerId || '',
            caseTitle: data.caseTitle || '',
            problemType: data.problemType || '',
            status: data.status || 'pending',
            reportedAt: data.reportedAt instanceof Timestamp ? data.reportedAt.toDate() : new Date(),
        };
    });

    return { cases, appointments, tickets };
}
