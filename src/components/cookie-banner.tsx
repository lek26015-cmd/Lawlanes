'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Cookie, X } from 'lucide-react';
import { Link } from '@/navigation';
import { Button } from './ui/button';

/**
 * ประกาศคุกกี้ — เว็บใช้เฉพาะคุกกี้ที่จำเป็น (ดู src/content/legal/cookies.ts) จึงเป็นแค่ "แจ้งให้ทราบ"
 * ไม่มีสวิตช์เปิด/ปิด
 *
 * เดิมมีสวิตช์ "วิเคราะห์พฤติกรรม" (เปิดไว้ก่อน) และ "การตลาด" แต่ไม่มีโค้ดไหนอ่านค่า cookie_prefs
 * และเว็บไม่มีเครื่องมือวิเคราะห์/โฆษณาเลย = สวิตช์หลอก ถ้าจะเพิ่มเครื่องมือแบบนั้นในอนาคต
 * ต้องทำหน้าขอความยินยอมจริง (ปิดเป็นค่าเริ่มต้น) และโหลดสคริปต์หลังได้รับความยินยอมเท่านั้น
 */
const CONSENT_KEY = 'cookie_consent';

export default function CookieBanner() {
  const t = useTranslations('CookieBanner');
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem(CONSENT_KEY);
    } catch {
      // เบราว์เซอร์บล็อก storage — แสดงประกาศทุกครั้ง
    }
    if (seen) return;
    const timer = setTimeout(() => setShow(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const acknowledge = () => {
    try {
      localStorage.setItem(CONSENT_KEY, 'necessary');
      localStorage.removeItem('cookie_prefs'); // ค่าจากแบนเนอร์เดิม ไม่มีใครใช้
    } catch {
      // ignore
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label={t('title')}
      className="fixed inset-x-4 bottom-4 z-[10000] mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/10 md:p-6"
    >
      <button
        onClick={acknowledge}
        aria-label={t('close')}
        className="absolute right-3 top-3 rounded-full p-1 text-slate-400 transition-colors hover:text-slate-900"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <div className="flex items-start gap-3 pr-6 md:pr-0">
          <Cookie className="mt-0.5 h-6 w-6 flex-shrink-0 text-[#002f4b]" />
          <div>
            <p className="font-semibold text-slate-900">{t('title')}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {t('body')}{' '}
              <Link href="/cookies" className="font-medium text-[#002f4b] underline underline-offset-2">
                {t('link')}
              </Link>
            </p>
          </div>
        </div>
        <Button
          onClick={acknowledge}
          className="h-11 flex-shrink-0 rounded-xl bg-[#002f4b] px-8 font-semibold text-white hover:bg-[#002f4b]/90 md:ml-auto"
        >
          {t('accept')}
        </Button>
      </div>
    </div>
  );
}
