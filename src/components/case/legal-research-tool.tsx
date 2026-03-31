'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Loader2, BookOpen, ExternalLink, Quote, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { retrieveDocuments } from '@/lib/rag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface LegalResearchToolProps {
  onCite?: (text: string, source: string) => void;
  className?: string;
}

export function LegalResearchTool({ onCite, className }: LegalResearchToolProps) {
  const t = useTranslations('CaseRoom');
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const docs = await retrieveDocuments(query);
      setResults(docs);
      if (docs.length === 0) {
        toast({
          title: t('noResults'),
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to search legal documents',
      });
    } finally {
      setLoading(false);
    }
  };

  const getPdfUrl = (source: string) => {
    // Expected format: ราชกิจจานุเบกษา/year/month/filename.pdf
    const parts = source.split('/');
    if (parts.length < 4) return null;
    
    // HuggingFace PDF URL format
    const year = parts[1];
    const month = parts[2];
    const filename = parts[3];
    
    return `https://huggingface.co/datasets/open-law-data-thailand/soc-ratchakitcha/resolve/main/pdf/iapp/${year}/${month}/${filename}`;
  };

  return (
    <div className={cn("flex flex-col h-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-l border-white/20 dark:border-white/5", className)}>
      {/* Header */}
      <div className="p-6 border-b border-white/20 dark:border-white/5 bg-gradient-to-br from-blue-600/5 to-indigo-600/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black flex items-center gap-2 italic uppercase tracking-tighter text-slate-900 dark:text-white">
            <div className="p-1.5 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
            {t('legalResearch')}
          </h3>
          <Badge variant="outline" className="bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200/50 text-[9px] font-black uppercase tracking-widest italic">
            AI Powered
          </Badge>
        </div>
        
        <form onSubmit={handleSearch} className="relative group">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('researchPlaceholder')}
              className="pl-11 h-12 text-sm bg-white/80 dark:bg-slate-950/80 border-white/40 dark:border-white/5 rounded-2xl shadow-inner focus:ring-4 ring-blue-500/10 transition-all font-medium"
            />
          </div>
          <Button 
            type="submit" 
            size="sm" 
            disabled={loading || !query.trim()}
            className="absolute right-1.5 top-1.5 h-9 rounded-xl bg-slate-900 hover:bg-black text-white px-4 font-bold shadow-xl transition-all active:scale-95"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </Button>
        </form>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-slate-400"
            >
              <div className="relative w-12 h-12 mb-4">
                <Loader2 className="w-12 h-12 animate-spin text-blue-500 opacity-20" />
                <Sparkles className="w-6 h-6 text-blue-600 absolute inset-0 m-auto animate-pulse" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black italic color-blue-500">กำลังสลายข้อกฎหมาย...</p>
            </motion.div>
          ) : results.length > 0 ? (
            results.map((result, idx) => {
              const isExpanded = expandedId === `${idx}`;
              const pdfUrl = getPdfUrl(result.source);
              
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="p-4 bg-white/60 dark:bg-slate-950/60 border-white/40 dark:border-white/5 hover:border-blue-400/40 transition-all shadow-xl shadow-slate-200/50 dark:shadow-none group relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-0.5 italic flex items-center gap-1">
                          <div className="w-1 h-1 bg-blue-600 rounded-full animate-pulse" />
                          {result.source.split('/').pop()?.replace('.jsonl', '') || 'DOCUMENT'}
                        </span>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] text-slate-400 font-bold">RELEVANCE SCORE</span>
                           <div className="h-1 w-12 bg-slate-100 rounded-full overflow-hidden">
                             <div className="h-full bg-blue-500" style={{ width: `${result.score * 100}%` }} />
                           </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {pdfUrl && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800" asChild title="Open Original PDF">
                            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 text-slate-600" />
                            </a>
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100 shadow-sm transition-all"
                          onClick={() => onCite?.(result.content, result.source)}
                          title={t('citeLaw')}
                        >
                          <Quote className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div 
                      className={cn(
                        "text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-thai select-all p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100/50 dark:border-white/5",
                        !isExpanded && "line-clamp-6"
                      )}
                    >
                      {result.content}
                    </div>

                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full mt-3 h-8 text-[10px] font-black text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest italic"
                      onClick={() => setExpandedId(isExpanded ? null : `${idx}`)}
                    >
                      {isExpanded ? (
                        <><ChevronUp className="w-3 h-3 mr-1.5" /> {t('nextAction').split(' ')[0]}</>
                      ) : (
                        <><ChevronDown className="w-3 h-3 mr-1.5" /> {t('viewFullText')}</>
                      )}
                    </Button>
                  </Card>
                </motion.div>
              );
            })
          ) : (
            !loading && query && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="text-center py-20 text-slate-400 space-y-3"
              >
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto opacity-50">
                   <Search className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold italic">{t('noResults')}</p>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
      
      {/* Footer Branding */}
      <div className="p-4 text-center opacity-20 border-t border-white/10">
         <p className="text-[8px] font-black uppercase tracking-[0.4em] italic text-slate-900 dark:text-white">Lawslane Neural Legal Search</p>
      </div>
    </div>
  );
}

function Badge({ children, variant, className }: any) {
  return (
    <div className={cn(
      "px-2 py-0.5 rounded-full border text-[10px] font-medium",
      variant === 'outline' ? "border-slate-200" : "bg-slate-100 border-transparent",
      className
    )}>
      {children}
    </div>
  )
}
