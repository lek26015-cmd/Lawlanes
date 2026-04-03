'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { Cookie, X, ShieldCheck, Settings, Check, ChevronLeft, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from './ui/switch';

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<'main' | 'settings'>('main');
  
  // Detailed cookie states
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

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

  const handleConsent = (type: 'all' | 'necessary' | 'custom') => {
    const consentValue = type === 'all' ? 'granted' : (type === 'necessary' ? 'partial' : 'custom');
    localStorage.setItem('cookie_consent', consentValue);
    
    // Save details if available
    if (type === 'all') {
      localStorage.setItem('cookie_prefs', JSON.stringify({ analytics: true, marketing: true }));
    } else if (type === 'necessary') {
      localStorage.setItem('cookie_prefs', JSON.stringify({ analytics: false, marketing: false }));
    } else {
      localStorage.setItem('cookie_prefs', JSON.stringify({ analytics, marketing }));
    }
    
    setShowBanner(false);
  };

  if (!mounted || !showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] w-[92%] max-w-4xl">
      <AnimatePresence mode="wait">
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="relative overflow-hidden rounded-[2.5rem] bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border border-indigo-100 dark:border-slate-800 shadow-[0_32px_64px_rgba(30,41,59,0.2)] dark:shadow-[0_32px_64px_rgba(0,0,0,0.5)]"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl opacity-50" />

          <div className="p-6 md:p-8">
            <AnimatePresence mode="wait">
              {view === 'main' ? (
                <motion.div 
                  key="main"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-10"
                >
                  <div className="hidden md:flex flex-shrink-0 items-center justify-center w-20 h-20 rounded-[2rem] bg-indigo-50 dark:bg-slate-800 shadow-xl shadow-indigo-100/50 dark:shadow-none text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-slate-700 transition-transform hover:scale-110">
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
                      className="group relative w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-50 rounded-2xl h-14 font-black text-lg shadow-2xl transition-all active:scale-95 overflow-hidden border-none"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-white/20 to-indigo-500/0 group-hover:translate-x-full transition-transform duration-1000 -translate-x-full" />
                      <Check className="h-5 w-5 mr-1" /> ยอมรับทั้งหมด
                    </Button>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setView('settings')}
                        className="flex-1 rounded-2xl h-11 text-xs font-bold border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all font-sans"
                      >
                        จำเป็นเท่านั้น
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setView('settings')}
                        className="rounded-2xl h-11 w-11 flex items-center justify-center border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="settings"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="relative z-10"
                >
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full hover:bg-indigo-50 dark:hover:bg-slate-800"
                        onClick={() => setView('main')}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">ตั้งค่าความเป็นส่วนตัว</h3>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
                      <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">โปร่งใสและปลอดภัย</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
                    {/* Necessary */}
                    <div className="p-5 rounded-[1.5rem] bg-white dark:bg-slate-800 border border-indigo-50 dark:border-slate-800 transition-all hover:shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <Switch disabled checked={true} />
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">จำเป็นพื้นฐาน</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">เพื่อให้เว็บไซต์ทำงานได้ปกติ (Force ON)</p>
                    </div>

                    {/* Analytics */}
                    <div className="p-5 rounded-[1.5rem] bg-white dark:bg-slate-800 border border-indigo-50 dark:border-slate-800 transition-all hover:shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                          <Cookie className="h-5 w-5" />
                        </div>
                        <Switch checked={analytics} onCheckedChange={setAnalytics} />
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">การวิเคราะห์พฤติกรรม</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">ช่วยให้เราเข้าใจการใช้งานเพื่อพัฒนาบริการให้ดียิ่งขึ้น</p>
                    </div>

                    {/* Marketing */}
                    <div className="p-5 rounded-[1.5rem] bg-white dark:bg-slate-800 border border-indigo-50 dark:border-slate-800 transition-all hover:shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                          <Settings className="h-5 w-5" />
                        </div>
                        <Switch checked={marketing} onCheckedChange={setMarketing} />
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">การตลาด & สถิติ</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">แนะนำบริการและโปรโมชันที่เหมาะกับคุณโดยเฉพาะ</p>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
                    <Button
                      variant="ghost"
                      onClick={() => handleConsent('necessary')}
                      className="rounded-xl h-11 px-6 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      ปิดทั้งหมด (Essential Only)
                    </Button>
                    <Button
                      onClick={() => handleConsent('custom')}
                      className="rounded-xl h-11 px-8 text-sm font-black bg-indigo-600 hover:bg-slate-900 text-white shadow-lg transition-all active:scale-95 border-none"
                    >
                      ยืนยันการตั้งค่า
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Close */}
          <button 
            onClick={() => setShowBanner(false)}
            className="absolute top-5 right-5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1 md:hidden"
          >
            <X className="h-6 w-6" />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
