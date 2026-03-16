
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { findLawyerSpecialties } from '@/ai/flows/find-lawyers-flow';

export default function HeroSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const t = useTranslations('HomePage.aiAnalysis');

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    try {
      const result = await findLawyerSpecialties({ problem: query });
      const specialties = result.specialties.join(',');
      router.push(`/lawyers?specialties=${encodeURIComponent(specialties)}`);
    } catch (error) {
      console.error('Failed to analyze search query:', error);
      router.push(`/lawyers`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full">
      <div className="relative group">
        {/* Animated Glow Border */}
        <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 rounded-full blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200 animate-rainbow-border-spin"></div>
        
        <form 
          onSubmit={handleSearch}
          className="relative flex items-center bg-slate-800/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl p-1.5 transition-all duration-300 focus-within:border-white/20"
        >
          <div className="flex items-center flex-1 px-4 lg:px-6">
            <Sparkles className="h-5 w-5 text-purple-400 mr-3 shrink-0" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('placeholder')}
              className="w-full bg-transparent border-none text-white placeholder:text-gray-400 text-sm md:text-base lg:text-lg focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none px-0 h-12"
            />
          </div>
          
          <Button 
            type="submit" 
            disabled={isAnalyzing || !query.trim()}
            className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-6 md:px-8 py-6 h-auto shadow-lg transition-all duration-300 transform active:scale-95 group/btn"
          >
            {isAnalyzing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline">{t('button')}</span>
                <span className="sm:hidden">{t('analyzing').split('...')[0]}</span>
                <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
              </div>
            )}
          </Button>
        </form>
      </div>

      {/* Suggested Search Terms */}
      <div className="mt-4 flex flex-wrap items-center justify-center lg:justify-start gap-2 md:gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
        <span className="text-gray-400 text-xs">{t('suggestedKeywordsPrefix') || 'ลองค้นหา:'}</span>
        {['โดนโกงแชร์', 'จดทะเบียนบริษัท', 'มรดก', 'สัญญาเช่า', 'หมิ่นประมาท'].map((keyword) => (
          <button
            key={keyword}
            onClick={() => {
              setQuery(keyword);
              // Trigger search after state update
              setTimeout(() => handleSearch(), 100);
            }}
            className="text-xs md:text-sm text-gray-300 hover:text-white px-3 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            {keyword}
          </button>
        ))}
      </div>
    </div>
  );
}
