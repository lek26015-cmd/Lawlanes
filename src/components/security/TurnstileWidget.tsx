'use client';

import React from 'react';
import Turnstile from 'react-turnstile';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  siteKey?: string;
}

/**
 * Reusable Cloudflare Turnstile component for bot protection.
 * Rationale: Turnstile is a non-intrusive alternative to CAPTCHA that preserves user privacy.
 */
export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({ 
  onVerify, 
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY 
}) => {
  if (!siteKey) {
    console.warn("Turnstile site key is missing");
    return null;
  }

  return (
    <div className="my-4 flex justify-center">
      <Turnstile
        sitekey={siteKey}
        onSuccess={(token) => onVerify(token)}
        theme="light"
        size="normal"
      />
    </div>
  );
};
