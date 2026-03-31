'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Languages, Star, ShieldCheck, MapPin, Phone, Mail, ChevronRight, Globe, Award, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface InterpreterProfile {
  id: string;
  name: string;
  languages: string[];
  specialties: string[];
  certified: boolean;
  rating: number;
  reviews: number;
  location: string;
  pricePerHour: number;
  imageUrl: string;
  isAvailable: boolean;
}

const mockInterpreters: InterpreterProfile[] = [
  {
    id: 'itp-1',
    name: 'คุณพัชรินทร์ รัตนวงศ์',
    languages: ['ไทย', 'อังกฤษ (Fluent)'],
    specialties: ['คดีแพ่ง', 'คดีอาญา', 'พยานหลักฐาน'],
    certified: true,
    rating: 4.9,
    reviews: 124,
    location: 'กรุงเทพฯ / ออนไลน์',
    pricePerHour: 1500,
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Patcharin',
    isAvailable: true
  },
  {
    id: 'itp-2',
    name: 'Mr. Zhang Wei',
    languages: ['ไทย', 'จีนกลาง (Native)'],
    specialties: ['คดีเศรษฐกิจ', 'การค้าระหว่างประเทศ'],
    certified: true,
    rating: 4.8,
    reviews: 86,
    location: 'กรุงเทพฯ / สมุทรปราการ',
    pricePerHour: 2000,
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zhang',
    isAvailable: true
  },
  {
    id: 'itp-3',
    name: 'Ms. Yuki Tanaka',
    languages: ['ไทย', 'ญี่ปุ่น (JLPT N1)'],
    specialties: ['กฎหมายครอบครัว', 'มรดก'],
    certified: false,
    rating: 4.7,
    reviews: 42,
    location: 'ออนไลน์เท่านั้น',
    pricePerHour: 1800,
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Yuki',
    isAvailable: false
  },
  {
    id: 'itp-4',
    name: 'คุณอัครพล พรหมมินทร์',
    languages: ['ไทย', 'ฝรั่งเศส (DELF C1)'],
    specialties: ['กฎหมายมหาชน', 'ตรวจเอกสาร'],
    certified: true,
    rating: 5.0,
    reviews: 28,
    location: 'เชียงใหม่ / ออนไลน์',
    pricePerHour: 1200,
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Akrapol',
    isAvailable: true
  }
];

export function InterpreterSearchTool({ className }: { className?: string }) {
  const t = useTranslations('CaseRoom');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCertified, setFilterCertified] = useState(false);

  const filteredInterpreters = mockInterpreters.filter(itp => {
    const matchesSearch = itp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         itp.languages.some(l => l.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         itp.specialties.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCertified = filterCertified ? itp.certified : true;
    return matchesSearch && matchesCertified;
  });

  return (
    <div className={cn("flex flex-col h-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-l border-white/20 dark:border-white/5", className)}>
      {/* Header Section */}
      <div className="p-8 border-b border-white/20 dark:border-white/5 bg-gradient-to-br from-indigo-600/5 via-blue-600/5 to-purple-600/5">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
             <h3 className="text-sm font-black flex items-center gap-2 italic uppercase tracking-tighter text-slate-900 dark:text-white">
                <div className="p-1.5 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-500/20">
                  <Globe className="w-4 h-4" />
                </div>
                {t('interpreterTitle')}
              </h3>
              <p className="text-[10px] text-slate-500 font-bold italic uppercase tracking-widest pl-8">Expert Network & Legal Translation</p>
          </div>
          <div className="flex gap-2">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setFilterCertified(!filterCertified)}
                className={cn(
                    "rounded-xl h-8 text-[9px] font-black uppercase tracking-widest italic transition-all",
                    filterCertified ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20" : "bg-white/50 border-white/40 text-slate-400"
                )}
            >
                <ShieldCheck className="w-3 h-3 mr-1" />
                Certified Only
            </Button>
          </div>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('interpreterSearchPlaceholder')}
            className="pl-12 h-14 text-sm bg-white/80 dark:bg-slate-950/80 border-white/40 dark:border-white/5 rounded-2xl shadow-inner focus:ring-4 ring-indigo-500/10 transition-all font-medium"
          />
        </div>
      </div>

      {/* Results Grid */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <AnimatePresence mode="popLayout">
           {filteredInterpreters.map((itp, idx) => (
             <motion.div
               key={itp.id}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: idx * 0.1 }}
             >
                <Card className="p-6 bg-white/60 dark:bg-slate-950/60 border-white/40 dark:border-white/5 hover:border-indigo-400/40 transition-all shadow-xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4">
                      {itp.isAvailable ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 px-2 py-1">
                            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                            Available
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-500/10 text-slate-400 border-none text-[8px] font-black uppercase tracking-widest px-2 py-1">Busy</Badge>
                      )}
                   </div>

                   <div className="flex gap-5">
                      <div className="space-y-3 flex flex-col items-center">
                         <div className="relative">
                            <Avatar className="w-16 h-16 rounded-2xl border-2 border-white dark:border-slate-800 shadow-xl group-hover:scale-105 transition-transform">
                                <AvatarImage src={itp.imageUrl} />
                                <AvatarFallback>{itp.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            {itp.certified && (
                                <div className="absolute -bottom-1 -right-1 p-1 bg-amber-500 rounded-lg text-white shadow-lg shadow-amber-500/40" title="Court Certified">
                                    <Award className="w-3 h-3" />
                                </div>
                            )}
                         </div>
                         <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900 rounded-full px-2 py-0.5 border border-white/50 shadow-sm">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span className="text-[10px] font-black text-slate-900 dark:text-white">{itp.rating}</span>
                         </div>
                      </div>

                      <div className="flex-1 space-y-4">
                         <div>
                            <h4 className="text-lg font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-1">{itp.name}</h4>
                            <div className="flex flex-wrap gap-1 items-center">
                               {itp.languages.map((lang, i) => (
                                 <span key={i} className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                                    <Globe className="w-2.5 h-2.5" />
                                    {lang}
                                 </span>
                               ))}
                            </div>
                         </div>

                         <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Specialties</p>
                                <div className="flex flex-wrap gap-1">
                                   {itp.specialties.map((spec, i) => (
                                     <span key={i} className="text-[9px] font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">{spec}</span>
                                   ))}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Location</p>
                                <p className="text-[9px] font-bold text-slate-600 flex items-center gap-1">
                                   <MapPin className="w-3 h-3 text-slate-400" />
                                   {itp.location}
                                </p>
                            </div>
                         </div>

                         <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                            <div className="flex flex-col">
                               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Hourly Rate</p>
                               <p className="text-sm font-black text-slate-900 dark:text-white">฿{itp.pricePerHour.toLocaleString()} <span className="text-[10px] text-slate-400">/ ชม.</span></p>
                            </div>
                            <Button 
                                size="sm" 
                                className="h-9 rounded-xl bg-slate-900 hover:bg-black text-white px-4 text-[10px] font-black uppercase tracking-widest transition-all hover:translate-x-1"
                            >
                                {t('bookInterpreter').split(' ')[0]} <ChevronRight className="w-3 h-3 ml-2" />
                            </Button>
                         </div>
                      </div>
                   </div>
                </Card>
             </motion.div>
           ))}
        </AnimatePresence>
      </div>

      {/* Footer Branding */}
      <div className="p-4 text-center opacity-20 border-t border-white/10">
         <p className="text-[8px] font-black uppercase tracking-[0.4em] italic text-slate-900 dark:text-white">Lawslane Global Professional Network</p>
      </div>
    </div>
  );
}
