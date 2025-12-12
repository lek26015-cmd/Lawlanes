'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { Cookie } from 'lucide-react';

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if the user has already consented
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleConsent = (consent: boolean) => {
    // In a real app, you might differentiate between essential/analytics cookies
    localStorage.setItem('cookie_consent', consent ? 'granted' : 'denied');
    setShowBanner(false);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gray-900 text-white shadow-2xl animate-in slide-in-from-bottom-5">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Cookie className="h-6 w-6 text-yellow-400 flex-shrink-0" />
          <p className="text-sm">
            เราใช้คุกกี้เพื่อพัฒนาประสบการณ์การใช้งานของคุณ
            คุณสามารถศึกษารายละเอียดเพิ่มเติมได้ที่{' '}
            <Link href="/privacy" className="underline hover:text-yellow-300">
              นโยบายความเป็นส่วนตัว
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleConsent(true)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            ยอมรับ
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleConsent(false)}
            className="bg-transparent border-gray-500 hover:bg-gray-800"
          >
            ปฏิเสธ
          </Button>
        </div>
      </div>
    </div>
  );
}
