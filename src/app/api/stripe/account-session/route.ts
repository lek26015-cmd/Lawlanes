import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

/**
 * API to create a Stripe Connect Account Session for embedded onboarding
 */
export async function POST(req: Request) {
  try {
    const { accountId } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    // Create an Account Session to enable embedded components
    const accountSession = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
        payments: { enabled: true },
        payouts: { enabled: true },
      },
    });

    return NextResponse.json({
      client_secret: accountSession.client_secret,
    });
  } catch (error: any) {
    console.error('Stripe Account Session Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
