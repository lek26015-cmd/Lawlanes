'use server';

import { initializeFirebase } from '@/firebase';
import { collection, getDocs, query, doc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';

export async function deleteTestData() {
    const { firestore: db } = initializeFirebase();
    if (!db) {
        return { success: false, error: 'Firebase Firestore not initialized' };
    }

    try {
        let deletedChats = 0;
        let deletedLawyers = 0;

        // Delete mock chats
        const chatsRef = collection(db, 'chats');
        const chatsSnapshot = await getDocs(chatsRef);

        for (const chatDoc of chatsSnapshot.docs) {
            const data = chatDoc.data();
            if (data.caseTitle?.includes('[ทดสอบ]') || data.lawyerId === 'mock-lawyer-001') {
                // Delete messages subcollection
                const messagesRef = collection(db, 'chats', chatDoc.id, 'messages');
                const messagesSnapshot = await getDocs(messagesRef);

                const batch = writeBatch(db);
                messagesSnapshot.docs.forEach((msgDoc) => {
                    batch.delete(msgDoc.ref);
                });
                await batch.commit();

                // Delete chat document
                await deleteDoc(chatDoc.ref);
                deletedChats++;
            }
        }

        // Delete mock lawyer profiles
        const lawyersRef = collection(db, 'lawyerProfiles');
        const lawyersSnapshot = await getDocs(lawyersRef);

        for (const lawyerDoc of lawyersSnapshot.docs) {
            const data = lawyerDoc.data();
            const name = data.name || '';
            if (
                lawyerDoc.id === 'mock-lawyer-001' ||
                name.includes('[ทดสอบ]') ||
                name.includes('จำลอง') ||
                name.includes('ทดสอบ')
            ) {
                await deleteDoc(lawyerDoc.ref);
                deletedLawyers++;
            }
        }

        return {
            success: true,
            deletedChats,
            deletedLawyers
        };
    } catch (error: any) {
        console.error('Error deleting test data:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteLawyerById(lawyerId: string) {
    const { firestore: db } = initializeFirebase();
    if (!db) {
        return { success: false, error: 'Firebase Firestore not initialized' };
    }

    try {
        const lawyerRef = doc(db, 'lawyerProfiles', lawyerId);
        const lawyerDoc = await getDoc(lawyerRef);

        if (!lawyerDoc.exists()) {
            return { success: false, error: 'ไม่พบข้อมูลทนายความ' };
        }

        await deleteDoc(lawyerRef);

        return { success: true };
    } catch (error: any) {
        console.error('Error deleting lawyer:', error);
        return { success: false, error: error.message };
    }
}
