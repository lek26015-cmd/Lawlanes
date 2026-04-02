'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { Cookie, X, ShieldCheck, Settings, Check } from 'lucide-react';

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if the user has already consented
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      // Small delay for better UX feel
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleConsent = (type: 'all' | 'necessary') => {
    localStorage.setItem('cookie_consent', type === 'all' ? 'granted' : 'partial');
    setShowBanner(false);
  };

  if (!mounted || !showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] w-[92%] max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-indigo-50/90 dark:bg-slate-900/90 backdrop-blur-3xl border border-white dark:border-slate-800 shadow-[0_32px_64px_rgba(30,41,59,0.2)] dark:shadow-[0_32px_64px_rgba(0,0,0,0.5)] p-6 md:p-8">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
          <div className="hidden md:flex flex-shrink-0 items-center justify-center w-20 h-20 rounded-[2rem] bg-white dark:bg-slate-800 shadow-xl shadow-indigo-100/50 dark:shadow-none text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-slate-700 transition-transform hover:scale-110">
            <Cookie className="h-10 w-10 animate-bounce group-hover:animate-none" />
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
              <div className="flex -space-x-1">
                {[1,2,3].map(i => (
                  <div key={i} className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border-2 border-white dark:border-slate-900 overflow-hidden">
                    <ShieldCheck className="w-full h-full p-0.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                ))}
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-indigo-700 dark:text-indigo-400">
                Guaranteed Privacy Standard
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 leading-tight">ยกระดับประสบการณ์ให้เหมาะสมกับคุณ</h3>
            <p className="text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              เราใช้คุกกี้เพื่อวิเคราะห์การใช้งานและมอบข้อเสนอพิเศษที่ตรงใจคุณมากที่สุด 
              คุณร่วมเป็นส่วนหนึ่งของการพัฒนาประสบการณ์ได้โดยการยอมรับคุกกี้ของเรา 
              อ่านเพิ่มเติมได้ที่{' '}
              <Link href="/privacy" className="font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 underline underline-offset-4 decoration-indigo-500/30 transition-colors">
                นโยบายความเป็นส่วนตัว
              </Link>
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto min-w-[240px]">
             <Button
                onClick={() => handleConsent('all')}
                className="group relative w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-50 rounded-2xl h-14 font-black text-lg shadow-2xl transition-all active:scale-95 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-white/20 to-indigo-500/0 group-hover:translate-x-full transition-transform duration-1000 -translate-x-full" />
                <Check className="h-5 w-5 mr-1" /> ยอมรับทั้งหมด
              </Button>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleConsent('necessary')}
                className="flex-1 rounded-2xl h-11 text-xs font-bold border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all font-sans"
              >
                จำเป็นเท่านั้น
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl h-11 w-11 flex items-center justify-center border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Close */}
        <button 
          onClick={() => setShowBanner(false)}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1 md:hidden"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
