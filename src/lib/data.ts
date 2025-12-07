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
import type { LawyerProfile, ImagePlaceholder, Ad, Article, Case, UpcomingAppointment, ReportedTicket, LawyerAppointmentRequest, LawyerCase, UserProfile } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export const getImageUrl = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageUrl ?? '';
export const getImageHint = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageHint ?? '';

// --- Lawyer Functions ---
export async function getApprovedLawyers(db: Firestore | null): Promise<LawyerProfile[]> {
  if (!db) return [];
  const lawyersRef = collection(db, 'lawyerProfiles');
  const q = query(lawyersRef, where('status', '==', 'approved'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LawyerProfile));
}

export async function getLawyerById(db: Firestore, id: string): Promise<LawyerProfile | undefined> {
  if (!db) return undefined;
  const lawyerRef = doc(db, 'lawyerProfiles', id);
  const docSnap = await getDoc(lawyerRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as LawyerProfile;
  }
  return undefined;
}

// --- Article Functions ---
export async function getAllArticles(db: Firestore | null): Promise<Article[]> {
  if (!db) return [];
  const articlesRef = collection(db, 'articles');
  const q = query(articlesRef, orderBy('publishedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      publishedAt: data.publishedAt?.toDate().toISOString() // Convert timestamp to string
    } as Article
  });
}

export async function getArticleBySlug(db: Firestore, slug: string): Promise<Article | undefined> {
  if (!db) return undefined;
  const articlesRef = collection(db, 'articles');
  const q = query(articlesRef, where('slug', '==', slug), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      publishedAt: data.publishedAt?.toDate().toISOString()
    } as Article;
  }
  return undefined;
}

// --- Ad Functions ---
export async function getAdsByPlacement(db: Firestore | null, placement: 'Homepage Carousel' | 'Lawyer Page Sidebar'): Promise<Ad[]> {
  if (!db) return [];
  const adsRef = collection(db, 'ads');
  const q = query(adsRef, where('placement', '==', placement), where('status', '==', 'active'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
}

export async function getAdById(db: Firestore, id: string): Promise<Ad | undefined> {
  if (!db) return undefined;
  const adRef = doc(db, 'ads', id);
  const docSnap = await getDoc(adRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Ad;
  }
  return undefined;
}

// --- User Dashboard Functions ---
export async function getDashboardData(db: Firestore, userId: string) {
  if (!db) return { cases: [], appointments: [], tickets: [] };

  // 1. Fetch Cases (Chats)
  const chatsRef = collection(db, 'chats');
  const casesQuery = query(chatsRef, where('participants', 'array-contains', userId));
  const casesSnapshot = await getDocs(casesQuery);

  const cases: Case[] = await Promise.all(casesSnapshot.docs.map(async (d) => {
    const data = d.data();
    const lawyerId = data.participants.find((p: string) => p !== userId);
    let lawyer = { id: 'unknown', name: 'Unknown Lawyer', imageUrl: '', imageHint: '' };

    if (lawyerId) {
      const lawyerDoc = await getDoc(doc(db, 'lawyerProfiles', lawyerId));
      if (lawyerDoc.exists()) {
        const lData = lawyerDoc.data();
        lawyer = {
          id: lawyerDoc.id,
          name: lData.name,
          imageUrl: lData.imageUrl || '',
          imageHint: lData.imageHint || ''
        };
      } else {
        // Fallback to users collection if not in lawyerProfiles (e.g. if role changed)
        const userDoc = await getDoc(doc(db, 'users', lawyerId));
        if (userDoc.exists()) {
          lawyer = {
            id: userDoc.id,
            name: userDoc.data().name,
            imageUrl: '',
            imageHint: ''
          }
        }
      }
    }

    return {
      id: d.id,
      title: data.caseTitle || 'คดีไม่ระบุชื่อ',
      status: data.status || 'active',
      lastMessage: data.lastMessage || '',
      lastMessageTimestamp: data.lastMessageAt ? format(data.lastMessageAt.toDate(), 'dd MMM yyyy HH:mm', { locale: th }) : '',
      lawyer: lawyer,
      updatedAt: data.lastMessageAt ? data.lastMessageAt.toDate() : new Date(),
    } as Case;
  }));

  // 2. Fetch Appointments
  const appointmentsRef = collection(db, 'appointments');
  const aptQuery = query(appointmentsRef, where('userId', '==', userId), where('status', '==', 'confirmed')); // Assuming 'confirmed' status
  const aptSnapshot = await getDocs(aptQuery);

  const appointments: UpcomingAppointment[] = await Promise.all(aptSnapshot.docs.map(async (d) => {
    const data = d.data();
    let lawyer = { name: 'Unknown Lawyer', imageUrl: '', imageHint: '' };
    if (data.lawyerId) {
      const lawyerDoc = await getDoc(doc(db, 'lawyerProfiles', data.lawyerId));
      if (lawyerDoc.exists()) {
        const lData = lawyerDoc.data();
        lawyer = { name: lData.name, imageUrl: lData.imageUrl || '', imageHint: lData.imageHint || '' };
      }
    }

    return {
      id: d.id,
      date: data.date.toDate(),
      time: data.timeSlot || 'N/A',
      description: data.description || 'นัดหมายปรึกษา',
      lawyer: lawyer,
    } as UpcomingAppointment;
  }));

  // Filter for future appointments only
  const futureAppointments = appointments.filter(apt => apt.date >= new Date());

  // 3. Fetch Tickets
  const ticketsRef = collection(db, 'tickets');
  const ticketsQuery = query(ticketsRef, where('userId', '==', userId));
  const ticketsSnapshot = await getDocs(ticketsQuery);

  const tickets: ReportedTicket[] = ticketsSnapshot.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      caseId: data.caseId || '',
      lawyerId: data.lawyerId || '',
      caseTitle: data.caseTitle || '',
      problemType: data.problemType || '',
      status: data.status || 'pending',
      reportedAt: data.reportedAt ? data.reportedAt.toDate() : new Date(),
    } as ReportedTicket;
  });

  return {
    cases,
    appointments: futureAppointments,
    tickets
  };
}

// --- Lawyer Dashboard Functions ---

export async function getLawyerDashboardData(db: Firestore, lawyerId: string): Promise<{ newRequests: LawyerAppointmentRequest[], activeCases: LawyerCase[], completedCases: LawyerCase[] }> {
  if (!db) return { newRequests: [], activeCases: [], completedCases: [] };
  // Fetch new appointment requests
  const appointmentsRef = collection(db, 'appointments');
  const requestsQuery = query(appointmentsRef, where('lawyerId', '==', lawyerId), where('status', '==', 'pending'));
  const requestsSnapshot = await getDocs(requestsQuery);
  const newRequests: LawyerAppointmentRequest[] = await Promise.all(requestsSnapshot.docs.map(async d => {
    const data = d.data();
    let clientName = 'ลูกค้า';
    if (data.userId) {
      const userDoc = await getDoc(doc(db, 'users', data.userId));
      if (userDoc.exists()) clientName = userDoc.data().name;
    }
    return {
      id: d.id,
      clientName: clientName,
      caseTitle: data.description,
      description: data.description,
      requestedAt: data.createdAt.toDate(),
    }
  }));

  // Fetch cases (chats)
  const chatsRef = collection(db, 'chats');
  const casesQuery = query(chatsRef, where('participants', 'array-contains', lawyerId));
  const casesSnapshot = await getDocs(casesQuery);
  const lawyerCases: LawyerCase[] = await Promise.all(casesSnapshot.docs.map(async (d) => {
    const chatData = d.data();
    const clientParticipantId = chatData.participants.find((p: string) => p !== lawyerId);

    let clientName = 'ลูกค้า';
    if (clientParticipantId) {
      const userDoc = await getDoc(doc(db, 'users', clientParticipantId));
      if (userDoc.exists()) clientName = userDoc.data().name;
    }

    return {
      id: d.id,
      title: chatData.caseTitle || 'Unknown Case',
      clientName: clientName,
      clientId: clientParticipantId,
      status: chatData.status,
      lastUpdate: chatData.lastMessageAt?.toDate().toLocaleDateString('th-TH') || 'N/A', // Assuming you add this field
    };
  }));

  return {
    newRequests,
    activeCases: lawyerCases.filter(c => c.status === 'active'),
    completedCases: lawyerCases.filter(c => c.status === 'closed'),
  };
}


export async function getLawyerAppointmentRequestById(db: Firestore, id: string): Promise<LawyerAppointmentRequest | undefined> {
  if (!db) return undefined;
  const reqRef = doc(db, 'appointments', id);
  const docSnap = await getDoc(reqRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    let clientName = 'ลูกค้า';
    if (data.userId) {
      const userDoc = await getDoc(doc(db, 'users', data.userId));
      if (userDoc.exists()) clientName = userDoc.data().name;
    }
    return {
      id: docSnap.id,
      clientName: clientName,
      caseTitle: data.description,
      description: data.description,
      requestedAt: data.createdAt.toDate(),
    };
  }
  return undefined;
}


// --- Data for Admin pages (can be more complex) ---

export async function getAllUsers(db: Firestore): Promise<UserProfile[]> {
  if (!db) return [];
  const usersRef = collection(db, 'users');
  const q = query(usersRef);
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      uid: doc.id,
      ...data,
      registeredAt: data.registeredAt?.toDate().toLocaleDateString('th-TH') || 'N/A'
    } as UserProfile;
  });
}


export async function getAllLawyers(db: Firestore): Promise<LawyerProfile[]> {
  if (!db) return [];
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
  if (!db) return [];
  const adsRef = collection(db, 'ads');
  const querySnapshot = await getDocs(adsRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
}

export async function getAllAdminArticles(db: Firestore): Promise<Article[]> {
  if (!db) return [];
  const articlesRef = collection(db, 'articles');
  const querySnapshot = await getDocs(articlesRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));
}

export async function getArticleById(db: Firestore, id: string): Promise<Article | undefined> {
  if (!db) return undefined;
  const articleRef = doc(db, 'articles', id);
  const docSnap = await getDoc(articleRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Article;
  }
  return undefined;
}


export async function getAllTickets(db: Firestore): Promise<any[]> {
  if (!db) return [];
  const ticketsRef = collection(db, 'tickets');
  const querySnapshot = await getDocs(ticketsRef);
  const tickets = await Promise.all(querySnapshot.docs.map(async (d) => {
    const data = d.data();
    let clientName = 'Unknown User';
    if (data.userId) {
      const userDoc = await getDoc(doc(db, 'users', data.userId));
      if (userDoc.exists()) {
        clientName = userDoc.data().name;
      }
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

export async function getAdminStats(db: Firestore) {
  if (!db) return {
    totalUsers: 0,
    newUsers: 0,
    activeTicketsCount: 0,
    pendingLawyersCount: 0,
    totalRevenue: 0 // Placeholder
  };

  // 1. Users Stats
  const usersRef = collection(db, 'users');
  const usersSnapshot = await getDocs(usersRef);
  const totalUsers = usersSnapshot.size;

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newUsers = usersSnapshot.docs.filter(doc => {
    const data = doc.data();
    return data.registeredAt && data.registeredAt.toDate() >= firstDayOfMonth;
  }).length;

  // 2. Tickets Stats
  const ticketsRef = collection(db, 'tickets');
  const ticketsQuery = query(ticketsRef, where('status', '==', 'pending'));
  const ticketsSnapshot = await getDocs(ticketsQuery);
  const activeTicketsCount = ticketsSnapshot.size;

  // 3. Lawyers Stats
  const lawyersRef = collection(db, 'lawyerProfiles');
  const lawyersQuery = query(lawyersRef, where('status', '==', 'pending'));
  const lawyersSnapshot = await getDocs(lawyersQuery);
  const pendingLawyersCount = lawyersSnapshot.size;

  return {
    totalUsers,
    newUsers,
    activeTicketsCount,
    pendingLawyersCount,
    totalRevenue: 0
  };
}