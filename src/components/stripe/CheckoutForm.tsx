'use client';

import React, { useState } from 'react';
import { 
  PaymentElement, 
  useStripe, 
  useElements 
} from '@stripe/react-stripe-js';
import { ShieldCheck, Loader2 } from 'lucide-react';

interface CheckoutFormProps {
  amount: number;
  currency: string;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({ amount, currency }) => {
  const stripe = useStripe();
  const elements = useElements();

  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard/billing/success`,
      },
    });

    if (error.type === "card_error" || error.type === "validation_error") {
      setMessage(error.message || "An error occurred.");
    } else {
      setMessage("An unexpected error occurred.");
    }

    setIsLoading(false);
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-6 flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Secure Checkout</p>
          <p className="text-xs text-blue-600">Your payment information is encrypted and processed by Stripe.</p>
        </div>
      </div>

      <PaymentElement id="payment-element" options={{ layout: 'tabs' }} />

      <button
        disabled={isLoading || !stripe || !elements}
        id="submit"
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          `Pay ${new Intl.NumberFormat('th-TH', { style: 'currency', currency }).format(amount / 100)}`
        )}
      </button>

      {message && (
        <div id="payment-message" className="text-sm font-medium text-rose-500 text-center p-3 bg-rose-50 rounded-lg">
          {message}
        </div>
      )}
    </form>
  );
};
