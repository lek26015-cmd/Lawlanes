'use server';

import { initializeFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

export async function addToVerifiedRegistry(data: {
    licenseNumber: string;
    firstName: string;
    lastName: string;
    province: string;
}) {
    try {
        const { firestore: db } = initializeFirebase();
        if (!db) {
            return { success: false, error: 'Firebase Firestore initialization failed' };
        }

        // Sanitize ID
        const docId = data.licenseNumber.replace(/\//g, '-');

        await setDoc(doc(db, 'verifiedLawyers', docId), {
            licenseNumber: data.licenseNumber,
            firstName: data.firstName,
            lastName: data.lastName,
            province: data.province,
            status: 'pending',
            registeredDate: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error adding to verified registry:", error);
        return { success: false, error: error.message };
    }
}
