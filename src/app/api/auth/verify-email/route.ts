import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { initAdmin } from '@/lib/firebase-admin';

/**
 * Custom email verification endpoint.
 * Validates a token stored in Firestore and sets emailVerified = true.
 * Token has a configurable expiry (default 7 days).
 *
 * GET /api/auth/verify-email?token=xxx
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing_token', req.url));
  }

  try {
    const app = await initAdmin();
    if (!app) {
      return NextResponse.redirect(new URL('/login?error=server_error', req.url));
    }

    const db = admin.firestore();
    const tokenDoc = await db.collection('email_verification_tokens').doc(token).get();

    if (!tokenDoc.exists) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', req.url));
    }

    const data = tokenDoc.data()!;
    const expiresAt = data.expiresAt?.toDate?.() || new Date(data.expiresAt);

    // Check if token has expired
    if (new Date() > expiresAt) {
      // Clean up expired token
      await db.collection('email_verification_tokens').doc(token).delete();
      return NextResponse.redirect(new URL('/login?error=expired_token', req.url));
    }

    // Check if already used
    if (data.used) {
      return NextResponse.redirect(new URL('/login?verified=already', req.url));
    }

    // Set emailVerified = true via Admin SDK
    const auth = admin.auth();
    await auth.updateUser(data.uid, { emailVerified: true });

    // Mark token as used (don't delete — keep for audit trail)
    await db.collection('email_verification_tokens').doc(token).update({
      used: true,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Redirect to login with success
    return NextResponse.redirect(new URL('/login?verified=true', req.url));
  } catch (error: any) {
    console.error('[Verify Email] Error:', error.message);
    return NextResponse.redirect(new URL('/login?error=verification_failed', req.url));
  }
}
