import Stripe from 'stripe';

// We use a getter to lazily initialize Stripe, avoiding build-time crashes
// when the STRIPE_SECRET_KEY is missing in the environment.
let stripeInstance: Stripe | null = null;

export const getStripe = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
      throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
    }
    // Return a dummy instance for build/dev if secret is missing
    return new Stripe('sk_test_dummy_unused_in_production', {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    });
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(stripeSecretKey, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    });
  }
  return stripeInstance;
};

// For backward compatibility with existing imports:
// This might still trigger the error if imported at top level, 
// so we use a Proxy or a getter-based export if supported.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_unused_in_production', {
  apiVersion: '2026-02-25.clover',
  typescript: true,
});
