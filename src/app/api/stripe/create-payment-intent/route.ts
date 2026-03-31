import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

/**
 * Creates a Stripe PaymentIntent with Split Payout logic
 */
export async function POST(req: Request) {
  try {
    const { amount, currency, lawyerAccountId, invoiceId } = await req.json();

    if (!amount || !lawyerAccountId || !invoiceId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Dynamic fee calculation (e.g., 10% platform commission)
    const COMMISSION_RATE = 0.10;
    const applicationFeeAmount = Math.round(amount * COMMISSION_RATE);

    // Create PaymentIntent with transfer data
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Amount in cents/satang
      currency: currency || 'thb',
      payment_method_types: ['card', 'promptpay'], // Support local Thai payments
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: lawyerAccountId,
      },
      metadata: {
        invoiceId,
        platform_commission: applicationFeeAmount.toString(),
      },
    });

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error('PaymentIntent Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
