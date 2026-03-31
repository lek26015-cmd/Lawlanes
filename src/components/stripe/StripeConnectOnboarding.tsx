'use client';

import React, { useEffect, useState } from 'react';
import { loadConnectAndComponents } from '@stripe/connect-js';

interface StripeConnectOnboardingProps {
  accountId: string;
}

export const StripeConnectOnboarding: React.FC<StripeConnectOnboardingProps> = ({ accountId }) => {
  const [stripeConnect, setStripeConnect] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/stripe/account-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId }),
        });

        const { client_secret, error } = await response.json();
        if (error) throw new Error(error);

        const connectInstance = await loadConnectAndComponents({
          publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
          fetchClientSecret: () => Promise.resolve(client_secret),
          appearance: {
            variables: {
              colorPrimary: '#0B3979',
            },
          },
        });

        setStripeConnect(connectInstance);
      } catch (err: any) {
        setError(err.message);
        console.error('Onboarding Error:', err);
      }
    };

    fetchSession();
  }, [accountId]);

  if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-lg">Error: {error}</div>;
  if (!stripeConnect) return <div className="p-4 text-slate-500 italic">Initializing secure onboarding...</div>;

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px]">
      <stripe-connect-account-onboarding
        onExit={() => {
          console.log('User exited onboarding');
          window.location.reload();
        }}
      />
    </div>
  );
};

// Types for Stripe Embedded Components
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'stripe-connect-account-onboarding': any;
    }
  }
}
