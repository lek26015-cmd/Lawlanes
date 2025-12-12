'use client';

import { useEffect, useState } from 'react';
import Turnstile from 'react-turnstile';

interface TurnstileWidgetProps {
    onVerify: (token: string) => void;
}

export function TurnstileWidget({ onVerify }: TurnstileWidgetProps) {
    const [siteKey, setSiteKey] = useState<string>('');

    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
        if (key) {
            setSiteKey(key);
        } else {
            console.warn('NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY is not set');
        }
    }, []);

    if (!siteKey) {
        return null; // Or a placeholder/warning in dev
    }

    return (
        <div className="flex justify-center my-4">
            <Turnstile
                sitekey={siteKey}
                onVerify={onVerify}
                theme="light"
            />
        </div>
    );
}
