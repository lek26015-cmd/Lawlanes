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
  Firestore,
  updateDoc,
  increment,
  getCountFromServer,
  writeBatch,
  setDoc
} from 'firebase/firestore';
import type { LawyerProfile, RegistryLawyer, ImagePlaceholder, Ad, Article, Case, UpcomingAppointment, ReportedTicket, LawyerAppointmentRequest, LawyerCase, UserProfile, LegalForm } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export const getImageUrl = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageUrl ?? '';
export const getImageHint = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageHint ?? '';

// --- Lawyer Functions ---
export async function getApprovedLawyers(db: Firestore, limitCount: number = 50): Promise<LawyerProfile[]> {
  if (!db) return [];
  try {
    const lawyersRef = collection(db, 'lawyerProfiles');
    const q = query(lawyersRef, where('status', '==', 'approved'), limit(limitCount));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Remove sensitive fields
      const { licenseUrl, idCardUrl, bankAccountNumber, ...safeData } = data;
      return {
        ...safeData,
        id: doc.id,
        joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate().toISOString() : (data.joinedAt || new Date().toISOString()),
        dob: data.dob?.toDate ? data.dob.toDate().toISOString() : (data.dob || null),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || null),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || data.joinedAt?.toDate ? data.joinedAt.toDate().toISOString() : new Date().toISOString()),
      } as unknown as LawyerProfile;
    });
  } catch (error) {
    console.error("Error fetching approved lawyers:", error);
    return [];
  }
}

/**
 * Fetch registry lawyers (from verifiedLawyers collection) that have a license number
 * but are NOT already registered on Lawslane. Used to show them in the search page.
 */
export async function getRegistryLawyers(
  db: Firestore,
  approvedLawyerLicenseNumbers: Set<string>,
  limitCount: number = 50
): Promise<RegistryLawyer[]> {
  if (!db) return [];
  try {
    const verifiedRef = collection(db, 'verifiedLawyers');
    const q = query(
      verifiedRef,
      where('status', '==', 'active'),
      limit(limitCount + approvedLawyerLicenseNumbers.size) // fetch extra to account for duplicates
    );
    const querySnapshot = await getDocs(q);

    const results: RegistryLawyer[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const licenseNumber = data.licenseNumber?.trim() || '';

      // Skip if no license number
      if (!licenseNumber) continue;

      // Skip if already registered on Lawslane
      if (approvedLawyerLicenseNumbers.has(licenseNumber)) continue;

      results.push({
        id: docSnap.id,
        prefix: data.prefix || '',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        licenseNumber,
        licenseType: data.licenseType || '',
        province: data.province || '',
        status: data.status || 'active',
        source: data.source || 'document_import',
      });

      if (results.length >= limitCount) break;
    }

    return results;
  } catch (error) {
    console.error('Error fetching registry lawyers:', error);
    return [];
  }
}

export async function getLawyerById(db: Firestore, id: string): Promise<LawyerProfile | undefined> {
  if (!db) return undefined;
  const lawyerRef = doc(db, 'lawyerProfiles', id);
  const docSnap = await getDoc(lawyerRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    // Remove sensitive fields
    const { licenseUrl, idCardUrl, bankAccountNumber, ...safeData } = data;
    return {
      ...safeData,
      id: docSnap.id,
      joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate().toISOString() : (data.joinedAt || new Date().toISOString()),
      dob: data.dob?.toDate ? data.dob.toDate().toISOString() : (data.dob || null),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || null),
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || data.joinedAt?.toDate ? data.joinedAt.toDate().toISOString() : new Date().toISOString()),
    } as unknown as LawyerProfile;
  }
  return undefined;
}

// --- Article Functions ---
export async function getAllArticles(db: Firestore | null): Promise<Article[]> {
  if (!db) return [];
  const articlesRef = collection(db, 'articles');
  const q = query(articlesRef, orderBy('publishedAt', 'desc'), limit(50));
  // const q = query(articlesRef);
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    let publishedAtStr = new Date().toISOString();

    if (data.publishedAt?.toDate) {
      publishedAtStr = data.publishedAt.toDate().toISOString();
    } else if (data.publishedAt instanceof Date) {
      publishedAtStr = data.publishedAt.toISOString();
    } else if (typeof data.publishedAt === 'string') {
      publishedAtStr = data.publishedAt;
    }

    return {
      id: doc.id,
      ...data,
      publishedAt: publishedAtStr
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
    let publishedAtStr = new Date().toISOString();

    if (data.publishedAt?.toDate) {
      publishedAtStr = data.publishedAt.toDate().toISOString();
    } else if (data.publishedAt instanceof Date) {
      publishedAtStr = data.publishedAt.toISOString();
    } else if (typeof data.publishedAt === 'string') {
      publishedAtStr = data.publishedAt;
    }

    return {
      id: docSnap.id,
      ...data,
      publishedAt: publishedAtStr
    } as Article;
  }
  return undefined;
}

// --- Ad Functions ---
export async function getAdsByPlacement(db: Firestore | null, placement: 'Homepage Carousel' | 'Lawyer Page Sidebar'): Promise<Ad[]> {
  if (!db) return [];
  const adsRef = collection(db, 'ads');
  const q = query(adsRef, where('placement', '==', placement), where('status', '==', 'active'), limit(10));
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

// --- Lawyer Dashboard Functions ---

export async function getLawyerDashboardData(db: Firestore, lawyerId: string): Promise<{ newRequests: LawyerAppointmentRequest[], activeCases: LawyerCase[], completedCases: LawyerCase[] }> {
  if (!db) return { newRequests: [], activeCases: [], completedCases: [] };

  try {
    // 1. Fetch appointments and chats in parallel
    const appointmentsRef = collection(db, 'appointments');
    const requestsQuery = query(appointmentsRef, where('lawyerId', '==', lawyerId), where('status', '==', 'paid'), limit(50)); // รับได้เฉพาะนัดที่จ่ายแล้ว — ดู dashboard-actions.ts

    const chatsRef = collection(db, 'chats');
    const casesQuery = query(chatsRef, where('participants', 'array-contains', lawyerId), limit(100));

    const [requestsSnapshot, casesSnapshot] = await Promise.all([
      getDocs(requestsQuery),
      getDocs(casesQuery)
    ]);

    // 2. Collect all unique user IDs to fetch in one batch
    const userIds = new Set<string>();
    requestsSnapshot.docs.forEach(d => { if (d.data().userId) userIds.add(d.data().userId); });
    casesSnapshot.docs.forEach(d => {
      const clientParticipantId = d.data().participants.find((p: string) => p !== lawyerId);
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
        getDocs(query(collection(db, 'users'), where('__name__', 'in', chunk)))
      ));
      userSnaps.forEach(snap => {
        snap.docs.forEach(doc => { userProfiles[doc.id] = doc.data(); });
      });
    }

    // 3. Map results
    const newRequests = requestsSnapshot.docs.map(d => {
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

    const lawyerCases = casesSnapshot.docs.map(d => {
      const chatData = d.data();
      const clientParticipantId = (chatData.participants || []).find((p: string) => p !== lawyerId) || chatData.clientId || chatData.userId || '';

      // Calculate if unread for lawyer
      const lastMessageAt = chatData.lastMessageAt?.toDate() || chatData.createdAt?.toDate() || new Date(0);
      const lawyerReadAt = chatData.lawyerReadAt?.toDate() || new Date(0);
      const isUnread = lastMessageAt > lawyerReadAt;
      const lastMessage = chatData.lastMessage || '';

      return {
        id: d.id,
        title: chatData.caseTitle || 'Unknown Case',
        clientName: userProfiles[clientParticipantId]?.name || 'ลูกความ',
        clientId: clientParticipantId,
        status: chatData.status,
        lastUpdate: lastMessageAt.toLocaleDateString('th-TH') || 'N/A',
        updatedAt: lastMessageAt,
        notifications: isUnread ? 1 : 0, // Using 1 as a flag for "has new messages"
        lastMessage: lastMessage,
      };
    });

    return {
      newRequests,
      activeCases: lawyerCases
        .filter(c => c.status === 'active' || c.status === 'pending_payment')
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
      completedCases: lawyerCases
        .filter(c => c.status === 'closed')
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    };

  } catch (error) {
    console.error("Error fetching lawyer dashboard data:", error);
    return { newRequests: [], activeCases: [], completedCases: [] };
  }
}

export async function getLawyerAppointmentRequestById(db: Firestore, id: string): Promise<LawyerAppointmentRequest | undefined> {
  if (!db) return undefined;
  const reqRef = doc(db, 'appointments', id);
  const docSnap = await getDoc(reqRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    let clientName = 'ลูกความ';
    if (data.userId) {
      const userDoc = await getDoc(doc(db, 'users', data.userId));
      if (userDoc.exists()) clientName = userDoc.data().name;
    }
    return {
      id: docSnap.id,
      clientName: clientName,
      userId: data.userId || '', // Include userId
      caseTitle: data.description,
      description: data.description,
      requestedAt: data.createdAt.toDate(),
    };
  }
  return undefined;
}

// --- Data for Admin pages (can be more complex) ---

export async function getLawyerStats(db: Firestore, lawyerId: string) {
  if (!db) return {
    incomeThisMonth: 0,
    totalIncome: 0,
    completedCases: 0,
    rating: 0,
    responseRate: 0
  };

  let incomeThisMonth = 0;
  let totalIncome = 0;
  let completedCases = 0;
  let rating = 0;
  let responseRate = 0;

  try {
    // 1. Parallelize data fetching. appointmentsCount/closedChatsCount only ever need
    // a count, not the documents themselves, so they use count aggregation queries
    // (billed as a single read each) instead of fetching up to 700 full docs — see
    // LAWSLANE-PLAN-01 2.3/2.9. The other three still need actual field values
    // (amounts, ratings, per-chat status) so they stay as bounded document fetches.
    const appointmentsQuery = query(collection(db, 'appointments'), where('lawyerId', '==', lawyerId), where('status', '==', 'completed'));
    const closedChatsQuery = query(collection(db, 'chats'), where('participants', 'array-contains', lawyerId), where('status', '==', 'closed'));

    const [transactionsSnapshot, appointmentsCountSnap, closedChatsCountSnap, reviewsSnapshot, allChatsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'transactions'), where('lawyerId', '==', lawyerId), where('status', '==', 'completed'), limit(1000))),
      getCountFromServer(appointmentsQuery),
      getCountFromServer(closedChatsQuery),
      getDocs(query(collection(db, 'reviews'), where('lawyerId', '==', lawyerId), limit(200))),
      getDocs(query(collection(db, 'chats'), where('participants', 'array-contains', lawyerId), limit(500)))
    ]);

    // Calculate revenue from transactions
    transactionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const netAmount = data.netAmount || 0;
      totalIncome += netAmount;

      const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
      const now = new Date();
      if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
        incomeThisMonth += netAmount;
      }
    });

    // Count completions
    completedCases = appointmentsCountSnap.data().count + closedChatsCountSnap.data().count;

    // Calculate ratings
    if (!reviewsSnapshot.empty) {
      const totalRating = reviewsSnapshot.docs.reduce((acc, doc) => acc + (doc.data().rating || 0), 0);
      rating = totalRating / reviewsSnapshot.size;
    }

    // Calculate response rate based on chats
    if (!allChatsSnapshot.empty) {
      const engagedChats = allChatsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.status === 'active' || data.status === 'closed';
      }).length;

      const totalRequests = allChatsSnapshot.docs.filter(doc => doc.data().status !== 'pending_payment').length;

      if (totalRequests > 0) {
        responseRate = (engagedChats / totalRequests) * 100;
      } else {
        responseRate = 100;
      }
    } else {
      responseRate = 100;
    }

  } catch (error) {
    console.error("Error calculating lawyer stats:", error);
  }

  return {
    incomeThisMonth,
    totalIncome,
    completedCases,
    rating: Number(rating.toFixed(1)),
    responseRate: Math.round(responseRate)
  };
}

export async function getLawyersByFirm(db: Firestore, firmId: string): Promise<LawyerProfile[]> {
  if (!db) return [];
  const q = query(collection(db, 'lawyerProfiles'), where('firmId', '==', firmId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as LawyerProfile));
}

// --- Legal Form Functions ---

export async function getAllLegalForms(db: Firestore): Promise<LegalForm[]> {
  if (!db) return [];
  const formsRef = collection(db, 'legalForms');
  const q = query(formsRef, orderBy('createdAt', 'desc'), limit(100));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LegalForm));
}

export async function incrementFormDownloads(db: Firestore, id: string) {
  if (!db) return;
  const formRef = doc(db, 'legalForms', id);
  await updateDoc(formRef, {
    downloads: increment(1)
  });
}
export async function getCaseById(db: Firestore, id: string): Promise<Case | undefined> {
  if (!db) return undefined;
  try {
    // 1. Try fetching from legalCases (Professional Pipeline)
    const legalCaseRef = doc(db, 'legalCases', id);
    const legalDocSnap = await getDoc(legalCaseRef);
    
    if (legalDocSnap.exists()) {
      const data = legalDocSnap.data();
      const clientId = data.client_id || '';
      let clientProfile = { name: 'ลูกความ', imageUrl: '' };
      
      if (clientId) {
        const userDoc = await getDoc(doc(db, 'users', clientId));
        if (userDoc.exists()) {
          const uData = userDoc.data();
          clientProfile = { name: uData.name || 'ลูกความ', imageUrl: uData.avatar || '' };
        }
      }

      return {
        id: legalDocSnap.id,
        title: data.title || 'เคสไม่มีชื่อ',
        status: data.status,
        updatedAt: new Date(data.updatedAt || Date.now()),
        clientName: clientProfile.name,
        clientAvatar: clientProfile.imageUrl,
        lawyer_id: data.lawyer_id,
        description: data.description || '',
        // ผลลัพธ์การจัดทำบัญชีระบุพยานล่าสุด (ถ้ามี) — ดู finalizeWitnessListAction
        witnessList: data.witnessList || null,
      } as any;
    }

    // 2. Fallback to chats collection
    const chatRef = doc(db, 'chats', id);
    const docSnap = await getDoc(chatRef);
    if (!docSnap.exists()) return undefined;

    const data = docSnap.data();
    const lawyerId = data.lawyerId || (data.participants && data.participants[0]); 
    const clientId = data.participants?.find((p: string) => p !== lawyerId) || '';

    let clientProfile = { name: 'ลูกความ', imageUrl: '' };
    if (clientId) {
      const userDoc = await getDoc(doc(db, 'users', clientId));
      if (userDoc.exists()) {
        const uData = userDoc.data();
        clientProfile = { name: uData.name || 'ลูกความ', imageUrl: uData.avatar || '' };
      }
    }

    const lastMessageAt = data.lastMessageAt?.toDate() || data.createdAt?.toDate() || new Date();

    return {
      id: docSnap.id,
      title: data.caseTitle || 'เคสไม่มีชื่อ',
      status: data.status,
      lastMessage: data.lastMessage || '',
      lastMessageTimestamp: lastMessageAt.toISOString(),
      updatedAt: lastMessageAt,
      lawyer: { id: lawyerId || '', name: '', imageUrl: '', imageHint: '' }, 
      clientName: clientProfile.name, 
      clientAvatar: clientProfile.imageUrl,
    } as any;
  } catch (error) {
    console.error("Error fetching case by id:", error);
    return undefined;
  }
}

// --- Page View Tracking ---

// Firestore caps sustained writes to ~1/sec per document. A single global
// counter throttles under real traffic, so the count is spread across N
// shard documents and summed back together on read.
const PAGE_VIEW_SHARD_COUNT = 10;

/**
 * Increment the page view counter for the current month.
 * Writes to one of several shard documents under siteStats/pageViews_shards
 * (chosen at random per call) to stay under Firestore's per-document write limit.
 * Each shard stores monthly fields (e.g. "2026-07": 1234).
 */
export async function incrementPageView(db: Firestore): Promise<void> {
  if (!db) return;
  try {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const shardId = String(Math.floor(Math.random() * PAGE_VIEW_SHARD_COUNT));
    const docRef = doc(db, 'siteStats', 'pageViews_shards', 'shards', shardId);
    await setDoc(docRef, { [monthKey]: increment(1) }, { merge: true });
  } catch (error) {
    // Silently fail — don't break user experience for analytics
    console.error("Error incrementing page view:", error);
  }
}

/**
 * Get total page views across all months, summed across all shards plus the
 * legacy single-document counter (siteStats/pageViews) that was used before
 * sharding, so switching to shards doesn't drop previously-collected history.
 */
export async function getTotalPageViews(db: Firestore): Promise<number> {
  if (!db) return 0;
  try {
    let total = 0;

    const legacyDocRef = doc(db, 'siteStats', 'pageViews');
    const legacyDocSnap = await getDoc(legacyDocRef);
    if (legacyDocSnap.exists()) {
      const data = legacyDocSnap.data();
      total += Object.values(data).reduce((sum: number, val) => sum + (typeof val === 'number' ? val : 0), 0);
    }

    const shardsRef = collection(db, 'siteStats', 'pageViews_shards', 'shards');
    const snapshot = await getDocs(shardsRef);
    snapshot.forEach((shardDoc) => {
      const data = shardDoc.data();
      total += Object.values(data).reduce((sum: number, val) => sum + (typeof val === 'number' ? val : 0), 0);
    });
    return total;
  } catch (error) {
    console.error("Error getting total page views:", error);
    return 0;
  }
}
