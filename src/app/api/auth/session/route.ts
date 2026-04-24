import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';

// NOTE: We are intentionally avoiding 'firebase-admin' here because it is not compatible with the Edge Runtime.
// This is a "Lightweight Session" implementation for Cloudflare Pages.

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const { idToken, redirect: requestedRedirect } = body;

        if (!idToken) {
            return NextResponse.json({ error: 'Missing ID Token' }, { status: 400 });
        }

        // Firebase Session Cookies usually last 5 days
        const expiresIn = 60 * 60 * 24 * 5 * 1000; 

        const cookieStore = await cookies();
        const host = request.headers.get('host')?.split(':')[0] || '';

        let cookieDomain: string | undefined = undefined;
        if (process.env.NODE_ENV === 'production') {
            const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'lawslane.com';
            cookieDomain = `.${rootDomain}`;
        }

        const cookieOptions: any = {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
        };

        if (cookieDomain) { cookieOptions.domain = cookieDomain; }

        const admin = await initAdmin();
        if (!admin) {
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }
        
        const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });
        const decodedToken = await admin.auth().verifySessionCookie(sessionCookie);

        // Store the verified session cookie
        cookieStore.set('session', sessionCookie, cookieOptions);

        // Add a non-httpOnly hint for the client
        cookieStore.set('session_hint', 'authenticated', {
            ...cookieOptions,
            httpOnly: false,
        });

        // 3. Centralized Role Detection and Redirection Logic
        let role = 'customer';
        try {
            const db = admin.firestore();
            
            // Priority 1: Check Custom Claims from Token
            if (decodedToken.admin === true) {
                role = 'admin';
            } else if (decodedToken.lawyer === true) {
                role = 'lawyer';
            } else {
                // Priority 2: Check Lawyer Profile (Firestore)
                const lawyerDoc = await db.collection('lawyerProfiles').doc(decodedToken.uid).get();
                if (lawyerDoc.exists) {
                    role = 'lawyer';
                } else {
                    // Priority 3: Check Users collection
                    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
                    if (userDoc.exists) {
                        role = userDoc.data()?.role || 'customer';
                    }
                }
            }
        } catch (dbErr) {
            console.error('Error fetching user role for session:', dbErr);
        }

        // Add a role hint cookie for middleware RBAC
        cookieStore.set('role_hint', role, {
            ...cookieOptions,
            httpOnly: false,
        });

        // Calculate a safe suggested redirect
        let suggestedRedirect = role === 'lawyer' ? '/lawyer-dashboard' : '/dashboard';
        
        if (requestedRedirect && typeof requestedRedirect === 'string') {
            suggestedRedirect = requestedRedirect;
        }

        // SECURITY: Sanitize redirect to prevent Lawslane -> Capdeal loops
        // If we are on Lawslane main domain, we never want to redirect to capdeal subdomain automatically
        if (suggestedRedirect.includes('capdeal.lawslane.com')) {
            suggestedRedirect = role === 'lawyer' ? '/lawyer-dashboard' : '/dashboard';
        }

        return NextResponse.json({ 
            success: true, 
            role, 
            suggestedRedirect 
        });
    } catch (error: any) {
        console.error('[Firebase Diagnostics] Session creation error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack,
            fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
        });
        
        let statusCode = 401;
        let errorMessage = error.message || 'Unauthorized';
        
        if (error.code === 'auth/id-token-expired') {
            errorMessage = 'Firebase ID Token has expired. Please refresh and try again.';
        } else if (error.code === 'auth/argument-error') {
            errorMessage = 'Invalid ID Token provided.';
        } else if (error.message?.includes('private key')) {
            errorMessage = 'Server configuration error: Invalid Firebase Private Key.';
            statusCode = 500;
        }

        return NextResponse.json({ error: errorMessage, code: error.code }, { status: statusCode });
    }
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session')?.value;

        if (!sessionCookie) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        // Validate via Firebase Admin
        const auth = await initAdmin();
        if (!auth) {
             return NextResponse.json({ authenticated: false }, { status: 401 });
        }
        try {
            const decodedToken = await auth.auth().verifySessionCookie(sessionCookie, true);
            return NextResponse.json({ authenticated: true, uid: decodedToken.uid });
        } catch (error) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }
    } catch (error) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }
}

export async function DELETE() {
    try {
        const cookieStore = await cookies();
        const host = (await headers()).get('host')?.split(':')[0] || '';
        let cookieDomain: string | undefined = undefined;

        if (process.env.NODE_ENV === 'production') {
            cookieDomain = `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'lawslane.com'}`;
        } else if (host.includes('localhost')) {
            cookieDomain = undefined;
        }

        const cookieOptions: any = { path: '/' };
        if (cookieDomain) { cookieOptions.domain = cookieDomain; }

        cookieStore.delete({ name: 'session', ...cookieOptions });
        cookieStore.delete({ name: 'session_hint', ...cookieOptions });
        cookieStore.delete({ name: 'role_hint', ...cookieOptions });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
