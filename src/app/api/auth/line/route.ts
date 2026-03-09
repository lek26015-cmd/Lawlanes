import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';

/**
 * LINE Login → Firebase Custom Token
 * 
 * Receives a LINE access token from the frontend (LIFF SDK),
 * verifies it with LINE, finds or creates a Firebase user,
 * and returns a Firebase Custom Token for signInWithCustomToken().
 */
export async function POST(req: NextRequest) {
    try {
        const { accessToken, idToken } = await req.json();

        if (!accessToken) {
            return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });
        }

        // 1. Verify the LINE access token and get user profile
        const verifyRes = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${accessToken}`, {
            method: 'GET',
        });

        if (!verifyRes.ok) {
            console.error('[LINE Auth] Token verification failed:', await verifyRes.text());
            return NextResponse.json({ error: 'Invalid LINE access token' }, { status: 401 });
        }

        const tokenInfo = await verifyRes.json();

        // Verify the token belongs to our LINE Login channel
        const expectedChannelId = process.env.LINE_LOGIN_CHANNEL_ID;
        if (expectedChannelId && tokenInfo.client_id !== expectedChannelId) {
            return NextResponse.json({ error: 'Token not for this channel' }, { status: 401 });
        }

        // 2. Get LINE user profile
        const profileRes = await fetch('https://api.line.me/v2/profile', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!profileRes.ok) {
            return NextResponse.json({ error: 'Failed to get LINE profile' }, { status: 500 });
        }

        const lineProfile = await profileRes.json();
        const lineUserId: string = lineProfile.userId;
        const displayName: string = lineProfile.displayName;
        const pictureUrl: string | undefined = lineProfile.pictureUrl;

        // 3. Try to get email from ID token (if available)
        let email: string | undefined;
        if (idToken) {
            try {
                const idTokenRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        id_token: idToken,
                        client_id: process.env.LINE_LOGIN_CHANNEL_ID || '',
                    }),
                });
                if (idTokenRes.ok) {
                    const idTokenData = await idTokenRes.json();
                    email = idTokenData.email;
                }
            } catch (err) {
                console.warn('[LINE Auth] ID token verification failed, continuing without email:', err);
            }
        }

        // 4. Initialize Firebase Admin
        const adminApp = await initAdmin();
        if (!adminApp) {
            return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
        }
        const adminAuth = adminApp.auth();
        const adminDb = adminApp.firestore();

        // 5. Find or create Firebase user
        let firebaseUid: string;

        // First, try to find by lineUserId in Firestore
        const lineUserQuery = await adminDb
            .collection('users')
            .where('lineUserId', '==', lineUserId)
            .limit(1)
            .get();

        if (!lineUserQuery.empty) {
            // User already linked
            firebaseUid = lineUserQuery.docs[0].id;
        } else if (email) {
            // Try to find by email (to link existing account)
            try {
                const existingUser = await adminAuth.getUserByEmail(email);
                firebaseUid = existingUser.uid;
                // Link LINE userId to existing account
                await adminDb.collection('users').doc(firebaseUid).set({
                    lineUserId,
                    lineDisplayName: displayName,
                    linePictureUrl: pictureUrl,
                }, { merge: true });
            } catch {
                // No existing user with that email, create new
                const newUser = await adminAuth.createUser({
                    email,
                    displayName,
                    photoURL: pictureUrl,
                });
                firebaseUid = newUser.uid;
                await adminDb.collection('users').doc(firebaseUid).set({
                    lineUserId,
                    lineDisplayName: displayName,
                    linePictureUrl: pictureUrl,
                    email,
                    createdAt: new Date(),
                    provider: 'line',
                }, { merge: true });
            }
        } else {
            // No email, create user without email
            // Use LINE userId as part of the UID for consistency
            const customUid = `line_${lineUserId}`;
            try {
                await adminAuth.getUser(customUid);
                firebaseUid = customUid;
            } catch {
                // Create new user
                await adminAuth.createUser({
                    uid: customUid,
                    displayName,
                    photoURL: pictureUrl,
                });
                firebaseUid = customUid;
                await adminDb.collection('users').doc(firebaseUid).set({
                    lineUserId,
                    lineDisplayName: displayName,
                    linePictureUrl: pictureUrl,
                    createdAt: new Date(),
                    provider: 'line',
                }, { merge: true });
            }
        }

        // 6. Create Firebase Custom Token
        const customToken = await adminAuth.createCustomToken(firebaseUid);

        return NextResponse.json({
            customToken,
            uid: firebaseUid,
            displayName,
        });
    } catch (error: any) {
        console.error('[LINE Auth] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
