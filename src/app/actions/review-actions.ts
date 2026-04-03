'use server';

import { initAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function submitReviewAction(data: {
    lawyerId: string;
    userId: string;
    author: string;
    avatar: string;
    rating: number;
    comment: string;
    caseId: string;
}) {
    const adminApp = await initAdmin();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized.');
    }
    const db = adminApp.firestore();

    try {
        const { lawyerId, userId, author, avatar, rating, comment, caseId } = data;

        // Check for duplicate review (same user + same case)
        const existingReview = await db.collection('reviews')
            .where('userId', '==', userId)
            .where('caseId', '==', caseId)
            .limit(1)
            .get();

        if (!existingReview.empty) {
            throw new Error('คุณได้ส่งรีวิวสำหรับเคสนี้ไปแล้ว');
        }

        // 1. Add the review document
        const reviewRef = await db.collection('reviews').add({
            lawyerId,
            userId,
            author,
            avatar,
            rating: Number(rating),
            comment,
            createdAt: FieldValue.serverTimestamp(),
            caseId
        });

        // 2. Calculate new average rating and review count
        // Fetch all reviews for this lawyer (limited to 500 for safety, though Admin SDK can handle more)
        const reviewsSnap = await db.collection('reviews')
            .where('lawyerId', '==', lawyerId)
            .limit(500)
            .get();

        const totalReviews = reviewsSnap.size;
        const totalRating = reviewsSnap.docs.reduce((acc, doc) => acc + (Number(doc.data().rating) || 0), 0);
        const newAverageRating = totalReviews > 0 ? totalRating / totalReviews : 0;

        // 3. Update lawyer document
        const lawyerProfileRef = db.collection('lawyerProfiles').doc(lawyerId);
        const userRef = db.collection('users').doc(lawyerId);

        // Update lawyerProfiles
        await lawyerProfileRef.set({
            averageRating: newAverageRating,
            reviewCount: totalReviews
        }, { merge: true });

        // Also update the users collection just in case (mirroring existing logic)
        await userRef.set({
            averageRating: newAverageRating,
            reviewCount: totalReviews
        }, { merge: true });

        return { success: true, reviewId: reviewRef.id };
    } catch (error: any) {
        console.error("Error in submitReviewAction:", error);
        throw new Error(error.message || "Failed to submit review");
    }
}

export async function getReviewsAction(lawyerId: string, limitCount: number = 100) {
    const adminApp = await initAdmin();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized.');
    }
    const db = adminApp.firestore();

    try {
        const reviewsSnap = await db.collection('reviews')
            .where('lawyerId', '==', lawyerId)
            .orderBy('createdAt', 'desc')
            .limit(limitCount)
            .get();

        const reviewsData = reviewsSnap.docs.map(doc => {
            const data = doc.data();
            // Ensure no non-serializable objects (like Timestamps) are passed to the client
            return {
                id: doc.id,
                author: data.author || 'Anonymous',
                avatar: data.avatar || '',
                rating: Number(data.rating) || 0,
                comment: data.comment || '',
                lawyerId: data.lawyerId,
                userId: data.userId,
                caseId: data.caseId,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                dateText: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('th-TH', { year: 'numeric', month: 'long' }) : 'N/A'
            };
        });

        return reviewsData;
    } catch (error: any) {
        console.error("Error in getReviewsAction:", error);
        throw new Error(error.message || "Failed to fetch reviews");
    }
}
