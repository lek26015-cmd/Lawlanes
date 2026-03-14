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
            const userDoc = await db.collection('users').doc(decodedToken.uid).get();
            if (userDoc.exists) {
                role = userDoc.data()?.role || 'customer';
            }
        } catch (dbErr) {
            console.error('Error fetching user role from Firestore:', dbErr);
        }

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
        console.error('Session creation error:', error);
        return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
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

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
