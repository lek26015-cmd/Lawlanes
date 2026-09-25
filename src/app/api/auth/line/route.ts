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

        if (!accessToken || typeof accessToken !== 'string') {
            return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });
        }

        // ต้องรู้ว่า token เป็นของ channel เราเท่านั้น — เดิมถ้าไม่ได้ตั้ง LINE_LOGIN_CHANNEL_ID
        // ก็ข้ามการเช็ค client_id ไปเลย → access token ของแอป LINE ตัวไหนก็ได้ (รวมแอปของ
        // ผู้โจมตีที่หลอกเหยื่อให้ล็อกอิน) แลกเป็น custom token เข้าบัญชีเหยื่อที่นี่ได้
        const expectedChannelId = process.env.LINE_LOGIN_CHANNEL_ID;
        if (!expectedChannelId) {
            console.error('[LINE Auth] LINE_LOGIN_CHANNEL_ID is not configured — refusing request.');
            return NextResponse.json({ error: 'LINE login is not configured' }, { status: 503 });
        }

        // 1. Verify the LINE access token and get user profile
        let verifyRes;
        try {
            verifyRes = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`, {
                method: 'GET',
            });
        } catch (err: any) {
            console.error('[LINE Auth] Token verification fetch failed (Network/DNS):', err);
            return NextResponse.json({ error: `LINE Token Check Network Error: ${err.message}` }, { status: 502 });
        }

        if (!verifyRes.ok) {
            console.error('[LINE Auth] Token verification failed:', await verifyRes.text());
            return NextResponse.json({ error: 'Invalid LINE access token' }, { status: 401 });
        }

        const tokenInfo = await verifyRes.json();

        // Verify the token belongs to our LINE Login channel
        if (tokenInfo.client_id !== expectedChannelId) {
            return NextResponse.json({ error: 'Token not for this channel' }, { status: 401 });
        }

        // 2. Get LINE user profile
        let profileRes;
        try {
            profileRes = await fetch('https://api.line.me/v2/profile', {
                headers: { 'Authorization': `Bearer ${accessToken}` },
            });
        } catch (err: any) {
            console.error('[LINE Auth] Profile fetch failed (Network/DNS):', err);
            return NextResponse.json({ error: `LINE Profile Network Error: ${err.message}` }, { status: 502 });
        }

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
                        client_id: expectedChannelId,
                    }).toString(),
                });
                if (idTokenRes.ok) {
                    const idTokenData = await idTokenRes.json();
                    // id token ต้องเป็นของคนเดียวกับ access token — เดิมไม่เช็ค จึงเอา access token
                    // ของตัวเองคู่กับ id token (ที่มีอีเมลคนอื่น) มาผูกบัญชีตามอีเมลนั้นได้
                    if (idTokenData.sub === lineUserId) {
                        email = idTokenData.email;
                    } else {
                        console.warn('[LINE Auth] id_token sub does not match access token user — ignoring email');
                    }
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
            let existingUser: Awaited<ReturnType<typeof adminAuth.getUserByEmail>> | null = null;
            try {
                existingUser = await adminAuth.getUserByEmail(email);
            } catch {
                existingUser = null;
            }
            // บัญชีแอดมินห้ามผูก LINE อัตโนมัติจากอีเมล — เข้าบัญชีแอดมินได้ด้วยรหัสผ่านตามปกติเท่านั้น
            if (existingUser && (existingUser.customClaims?.admin === true || existingUser.customClaims?.role === 'admin')) {
                return NextResponse.json({ error: 'บัญชีนี้ไม่รองรับการเข้าสู่ระบบด้วย LINE' }, { status: 403 });
            }
            if (existingUser) {
                firebaseUid = existingUser.uid;
                // Link LINE userId to existing account
                await adminDb.collection('users').doc(firebaseUid).set({
                    lineUserId,
                    lineDisplayName: displayName,
                    linePictureUrl: pictureUrl,
                }, { merge: true });
            } else {
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
