import { initAdmin } from '../firebase-admin';
import * as admin from 'firebase-admin';

/**
 * Checks if a user has exceeded the rate limit for a specific action.
 * Uses Firestore transactions for atomicity and serverless compatibility.
 * 
 * @param userId - The ID of the user to check.
 * @param limit - Maximum number of requests allowed in the window.
 * @param windowMs - The time window in milliseconds (default 5000ms = 5s).
 * @returns { Promise<{ success: boolean; error?: string }> }
 */
export async function checkRateLimit(userId: string, limit: number = 10, windowMs: number = 5000) {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) {
            console.error("RateLimiter: Firebase Admin not initialized");
            return { success: true }; // Fail open if infrastructure is down
        }
        const db = adminApp.firestore();

        const now = Date.now();
        const windowStart = now - windowMs;
        const rateLimitRef = db.collection('rate_limits').doc(userId);

        return await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(rateLimitRef);
            let timestamps: number[] = [];

            if (doc.exists) {
                const data = doc.data();
                // Filter out timestamps older than the current window
                timestamps = (data?.timestamps || []).filter((ts: number) => ts > windowStart);
            }

            if (timestamps.length >= limit) {
                return { success: false, error: 'Rate limit exceeded. Please wait a moment.' };
            }

            // Add the current request's timestamp
            timestamps.push(now);

            // Update the rate limit document
            transaction.set(rateLimitRef, { 
                timestamps,
                lastUpdate: admin.firestore.FieldValue.serverTimestamp()
            });

            return { success: true };
        });
    } catch (error) {
        console.error("RateLimit check error:", error);
        // In case of any technical error, we fail open to ensure users can still communicate,
        // but we log the incident for monitoring.
        return { success: true };
    }
}
