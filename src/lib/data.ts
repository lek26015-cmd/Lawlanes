
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    getDoc, 
    doc, 
    limit, 
    orderBy,
    DocumentData,
    Firestore
} from 'firebase/firestore';
import type { LawyerProfile, ImagePlaceholder, Ad, Article, Case, UpcomingAppointment, ReportedTicket, LawyerAppointmentRequest, LawyerCase } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export const getImageUrl = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageUrl ?? '';
export const getImageHint = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageHint ?? '';

// --- Lawyer Functions ---
export async function getApprovedLawyers(db: Firestore): Promise<LawyerProfile[]> {
  const lawyersRef = collection(db, 'lawyerProfiles');
  const q = query(lawyersRef, where('status', '==', 'approved'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LawyerProfile));
}

export async function getLawyerById(db: Firestore, id: string): Promise<LawyerProfile | undefined> {
  const lawyerRef = doc(db, 'lawyerProfiles', id);
  const docSnap = await getDoc(lawyerRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as LawyerProfile;
  }
  return undefined;
}

// --- Article Functions ---
export async function getAllArticles(db: Firestore): Promise<Article[]> {
  const articlesRef = collection(db, 'articles');
  const q = query(articlesRef, orderBy('publishedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));
}

export async function getArticleBySlug(db: Firestore, slug: string): Promise<Article | undefined> {
  const articlesRef = collection(db, 'articles');
  const q = query(articlesRef, where('slug', '==', slug), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Article;
  }
  return undefined;
}

// --- Ad Functions ---
export async function getAdsByPlacement(db: Firestore, placement: 'Homepage Carousel' | 'Lawyer Page Sidebar'): Promise<Ad[]> {
  const adsRef = collection(db, 'ads');
  const q = query(adsRef, where('placement', '==', placement), where('status', '==', 'active'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
}

export async function getAdById(db: Firestore, id: string): Promise<Ad | undefined> {
    const adRef = doc(db, 'ads', id);
    const docSnap = await getDoc(adRef);
    if(docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Ad;
    }
    return undefined;
}

// --- User Dashboard Functions ---
export async function getDashboardData(db: Firestore, userId: string): Promise<{ cases: Case[], appointments: UpcomingAppointment[], tickets: ReportedTicket[] }> {
    // Fetch Cases (Chats)
    const chatsRef = collection(db, 'chats');
    const casesQuery = query(chatsRef, where('participants', 'array-contains', userId));
    const casesSnapshot = await getDocs(casesQuery);
    const cases: Case[] = await Promise.all(casesSnapshot.docs.map(async (d) => {
        const chatData = d.data();
        const otherParticipantId = chatData.participants.find((p: string) => p !== userId);
        const lawyerProfile = otherParticipantId ? await getLawyerById(db, otherParticipantId) : null;
        
        return {
            id: d.id,
            title: chatData.caseTitle || 'Unknown Case',
            lawyer: {
                id: lawyerProfile?.id || '',
                name: lawyerProfile?.name || 'Unknown Lawyer',
                imageUrl: lawyerProfile?.imageUrl || '',
                imageHint: lawyerProfile?.imageHint || ''
            },
            lastMessage: '...', // This would require fetching last message
            lastMessageTimestamp: '',
            status: 'active', // This would need to be stored on the chat doc
        };
    }));

    // Fetch Appointments
    const appointmentsRef = collection(db, 'appointments');
    const appointmentsQuery = query(appointmentsRef, where('userId', '==', userId), where('status', '==', 'pending'));
    const appointmentsSnapshot = await getDocs(appointmentsQuery);
    const appointments: UpcomingAppointment[] = appointmentsSnapshot.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            lawyer: {
                name: data.lawyerName,
                imageUrl: data.lawyerImageUrl,
                imageHint: '',
            },
            date: data.appointmentDate.toDate(),
            description: data.description,
            time: format(data.appointmentDate.toDate(), 'HH:mm น.')
        }
    });
    
    // Fetch Tickets
    const ticketsRef = collection(db, 'tickets');
    const ticketsQuery = query(ticketsRef, where('userId', '==', userId));
    const ticketsSnapshot = await getDocs(ticketsQuery);
    const tickets: ReportedTicket[] = ticketsSnapshot.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            caseId: data.caseId,
            caseTitle: `เคส ${data.caseId}`,
            problemType: data.problemType,
            status: data.status,
            reportedAt: data.reportedAt.toDate(),
            lawyerId: '' // This info might not be directly on the ticket
        }
    })

    return { cases, appointments, tickets };
}

// --- Lawyer Dashboard Functions ---

export async function getLawyerDashboardData(db: Firestore, lawyerId: string): Promise<{ newRequests: LawyerAppointmentRequest[], activeCases: LawyerCase[], completedCases: LawyerCase[] }> {
    // Fetch new appointment requests
    const appointmentsRef = collection(db, 'appointments');
    const requestsQuery = query(appointmentsRef, where('lawyerId', '==', lawyerId), where('status', '==', 'pending'));
    const requestsSnapshot = await getDocs(requestsQuery);
    const newRequests: LawyerAppointmentRequest[] = requestsSnapshot.docs.map(d => {
        const data = d.data();
        // In a real app, you'd fetch client name from users collection
        return {
            id: d.id,
            clientName: 'ลูกค้าใหม่', // Placeholder
            caseTitle: data.description,
            description: data.description,
            requestedAt: data.createdAt.toDate(),
        }
    });

    // Fetch cases (chats)
    const chatsRef = collection(db, 'chats');
    const casesQuery = query(chatsRef, where('participants', 'array-contains', lawyerId));
    const casesSnapshot = await getDocs(casesQuery);
    const lawyerCases: LawyerCase[] = await Promise.all(casesSnapshot.docs.map(async (d) => {
        const chatData = d.data();
        const clientParticipantId = chatData.participants.find((p: string) => p !== lawyerId);
        
        let clientName = 'ลูกค้า';
        if(clientParticipantId) {
             const userDoc = await getDoc(doc(db, 'users', clientParticipantId));
             if(userDoc.exists()) clientName = userDoc.data().name;
        }

        return {
            id: d.id,
            title: chatData.caseTitle || 'Unknown Case',
            clientName: clientName,
            clientId: clientParticipantId,
            status: 'กำลังดำเนินการ', // This needs to be stored on chat doc
            lastUpdate: '...', // Would need to fetch last message
        };
    }));

    return {
        newRequests,
        activeCases: lawyerCases.filter(c => c.status === 'กำลังดำเนินการ'),
        completedCases: lawyerCases.filter(c => c.status === 'เสร็จสิ้น'),
    };
}


export async function getLawyerAppointmentRequestById(db: Firestore, id: string): Promise<LawyerAppointmentRequest | undefined> {
    const reqRef = doc(db, 'appointments', id);
    const docSnap = await getDoc(reqRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
         // In a real app, you'd fetch client name from users collection
        return {
            id: docSnap.id,
            clientName: 'ลูกค้า (ดึงข้อมูลจริง)',
            caseTitle: data.description,
            description: data.description,
            requestedAt: data.createdAt.toDate(),
        };
    }
    return undefined;
}


// --- Data for Admin pages (can be more complex) ---

export async function getAllUsers(db: Firestore): Promise<any[]> {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('role', '==', 'customer'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    registeredAt: doc.data().registeredAt?.toDate().toLocaleDateString('th-TH') || 'N/A'
  }));
}


export async function getAllLawyers(db: Firestore): Promise<LawyerProfile[]> {
    const lawyersRef = collection(db, 'lawyerProfiles');
    const querySnapshot = await getDocs(lawyersRef);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            joinedAt: data.joinedAt?.toDate().toLocaleDateString('th-TH') || 'N/A'
        } as LawyerProfile
    });
}

export async function getAllAds(db: Firestore): Promise<Ad[]> {
  const adsRef = collection(db, 'ads');
  const querySnapshot = await getDocs(adsRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
}

export async function getAllAdminArticles(db: Firestore): Promise<Article[]> {
  const articlesRef = collection(db, 'articles');
  const querySnapshot = await getDocs(articlesRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));
}

export async function getArticleById(db: Firestore, id: string): Promise<Article | undefined> {
  const articleRef = doc(db, 'articles', id);
  const docSnap = await getDoc(articleRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Article;
  }
  return undefined;
}


export async function getAllTickets(db: Firestore): Promise<any[]> {
  const ticketsRef = collection(db, 'tickets');
  const querySnapshot = await getDocs(ticketsRef);
  const tickets = await Promise.all(querySnapshot.docs.map(async (d) => {
    const data = d.data();
    let clientName = 'Unknown User';
    const userDoc = await getDoc(doc(db, 'users', data.userId));
    if (userDoc.exists()) {
      clientName = userDoc.data().name;
    }
    return {
      id: d.id,
      ...data,
      clientName,
      reportedAt: data.reportedAt.toDate().toLocaleDateString('th-TH'),
    };
  }));
  return tickets;
}
