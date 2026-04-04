'use server';

import { initializeFirebase } from '@/firebase';
import { collection, getDocs, query, doc, deleteDoc, writeBatch, getDoc, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

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
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
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
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

export async function setupTestAccounts() {
    const adminApp = await initAdmin();
    if (!adminApp) {
        return { success: false, error: 'Firebase Admin not initialized. Check your environment variables (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).' };
    }
    const adminAuth = adminApp.auth();
    const adminDb = adminApp.firestore();

    try {
        const testAccounts = [
            { email: 'lawyer-test@lawslane.com', password: 'lawslane1234', role: 'lawyer', name: 'ทนายทดสอบ ระบบ (Test Lawyer)' },
            { email: 'client-test@lawslane.com', password: 'lawslane1234', role: 'customer', name: 'ลูกความทดสอบ ระบบ (Test Client)' }
        ];

        for (const account of testAccounts) {
            let uid = '';
            try {
                const userRecord = await adminAuth.getUserByEmail(account.email);
                uid = userRecord.uid;
                
                // Force update password and display name to ensure test login works
                await adminAuth.updateUser(uid, {
                    password: account.password,
                    displayName: account.name,
                });
                
                console.log(`User ${account.email} already exists with UID: ${uid}. Updated password.`);
            } catch (error: any) {
                if (error.code === 'auth/user-not-found') {
                    const userRecord = await adminAuth.createUser({
                        email: account.email,
                        password: account.password,
                        displayName: account.name,
                    });
                    uid = userRecord.uid;
                    console.log(`Created new Auth user for ${account.email} with UID: ${uid}`);
                } else {
                    throw error;
                }
            }

            // Ensure Firestore record exists
            if (account.role === 'lawyer') {
                const lawyerRef = adminDb.collection('lawyerProfiles').doc(uid);
                const lawyerSnap = await lawyerRef.get();
                if (!lawyerSnap.exists) {
                    await lawyerRef.set({
                        name: account.name,
                        email: account.email,
                        role: 'lawyer',
                        specialty: ['กฎหมายแพ่ง', 'กฎหมายอาญา'],
                        rating: 5.0,
                        reviewCount: 12,
                        status: 'approved',
                        isOnline: true,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        pricing: {
                            appointmentFee: 500,
                            chatFee: 0,
                            platformFeeRate: 0.15
                        }
                    });
                }
            } else {
                const userRef = adminDb.collection('users').doc(uid);
                const userSnap = await userRef.get();
                if (!userSnap.exists) {
                    await userRef.set({
                        name: account.name,
                        email: account.email,
                        role: 'customer',
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error setting up test accounts:', error);
        return { success: false, error: error.message };
    }
}
