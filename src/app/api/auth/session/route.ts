import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';

// NOTE: We are intentionally avoiding 'firebase-admin' here because it is not compatible with the Edge Runtime.
// This is a "Lightweight Session" implementation for Cloudflare Pages.

export async function POST(request: Request) {
    try {
        const { idToken } = await request.json();
        // Firebase Session Cookies usually last 5 days, but idTokens are short-lived (1 hour).
        // However, for this lightweight implementation, we store the idToken in the cookie.
        // In a more robust implementation, you would verify this token using a library like 'jose'.
        const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days (nominal)

        const cookieStore = await cookies();
        const host = request.headers.get('host')?.split(':')[0] || '';

        let cookieDomain: string | undefined = undefined;
        if (process.env.NODE_ENV === 'production') {
            const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'lawslane.com';
            cookieDomain = `.${rootDomain}`;
        } else if (host.includes('localhost')) {
            cookieDomain = undefined;
        }

        const cookieOptions: any = {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
        };

        if (cookieDomain) { cookieOptions.domain = cookieDomain; }

        // Store the raw ID token as the session cookie
        cookieStore.set('session', idToken, cookieOptions);

        const auth = await initAdmin();
        if (!auth) {
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }
        
        const sessionCookie = await auth.auth().createSessionCookie(idToken, { expiresIn });

        // Store the verified session cookie
        cookieStore.set('session', sessionCookie, cookieOptions);

        // Add a non-httpOnly hint for the client
        cookieStore.set('session_hint', 'authenticated', {
            ...cookieOptions,
            httpOnly: false,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Lightweight Session creation error:', error);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
