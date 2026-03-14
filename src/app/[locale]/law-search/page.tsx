'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, BookOpen, Loader2, ArrowRight, Info, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchResult, searchLaws } from '@/app/actions/law-search-actions';

export default function LawSearchPage() {
    const t = useTranslations('common');
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<SearchResult[] | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        setHasSearched(true);
        try {
            const data = await searchLaws(query);
            setResults(data);
        } catch (error) {
            console.error(error);
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 0.8) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (score >= 0.65) return 'text-blue-600 bg-blue-50 border-blue-200';
        return 'text-amber-600 bg-amber-50 border-amber-200';
    };

    const getScoreLabel = (score: number) => {
        if (score >= 0.8) return 'Very High Match';
        if (score >= 0.65) return 'Good Match';
        return 'Possible Match';
    };

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            {/* Header Section */}
            <div className="bg-white border-b border-slate-200 pt-24 pb-12">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <div className="inline-flex items-center justify-center p-3 bg-blue-50 rounded-2xl mb-6">
                        <BookOpen className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
                        Semantic Law Search
                    </h1>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-8">
                        ค้นหากฎหมาย แม่นยำด้วย AI ค้นหาจาก "ความหมาย" ไม่ต้องจำคีย์เวิร์ดเป๊ะๆ (เช่น ลาคลอด, โดนโกงแชร์, เลิกจ้าง)
                    </p>

                    <form onSubmit={handleSearch} className="relative max-w-3xl mx-auto">
                        <div className="relative flex items-center shadow-sm rounded-full bg-white border-2 border-slate-200 hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all duration-300">
                            <Search className="absolute left-6 w-6 h-6 text-slate-400" />
                            <Input
                                type="text"
                                placeholder="เล่าเรื่องของคุณ หรือ พิมพ์ข้อกฎหมายที่ต้องการค้นหา..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="w-full pl-16 pr-32 py-8 text-lg rounded-full border-none focus-visible:ring-0 shadow-none bg-transparent"
                            />
                            <Button 
                                type="submit" 
                                disabled={isSearching || !query.trim()}
                                className="absolute right-3 rounded-full px-8 py-6 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                            >
                                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ค้นหา'}
                            </Button>
                        </div>
                    </form>
                    
                    <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
                        <span className="text-slate-500 mr-2">ลองค้นหา:</span>
                        {['ลาพักร้อน', 'หมิ่นประมาทออนไลน์', 'ทำร้ายร่างกาย', 'เบี้ยวหนี้', 'กฎหมายลิขสิทธิ์'].map((suggestion) => (
                            <button 
                                key={suggestion}
                                onClick={() => {
                                    setQuery(suggestion);
                                    setTimeout(() => document.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })), 100);
                                }}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Results Section */}
            <div className="max-w-4xl mx-auto px-4 py-12">
                {isSearching ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="relative w-16 h-16 mb-4">
                            <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                        </div>
                        <p className="text-slate-500 animate-pulse">กำลังให้ AI กวาดค้นหาฐานข้อมูลกฎหมายทั่วประเทศ...</p>
                    </div>
                ) : hasSearched && results ? ( // Only show if results is not null
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
                            <h2 className="text-xl font-semibold text-slate-800">
                                ผลการค้นหาสำหรับ "{query}"
                            </h2>
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
                                พบ {results.length} รายการ
                            </span>
                        </div>
                        
                        {results.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-slate-700 mb-2">ไม่พบข้อกฎหมายที่ตรงกับคำค้นหา</h3>
                                <p className="text-slate-500">ลองปรับเปลี่ยนคำค้นหาให้กว้างขึ้น หรือใช้คำอธิบายที่แตกต่างออกไป</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {results.map((result, index) => (
                                    <div 
                                        key={index}
                                        className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow group"
                                    >
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1 flex-shrink-0">
                                                    <ShieldCheck className="w-6 h-6 text-blue-500" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                                                        {result.source.split('/').pop()?.replace('.pdf', '') || 'เอกสารกฎหมาย'}
                                                    </h3>
                                                    <div className="flex items-center mt-1 text-sm text-slate-500 gap-2">
                                                        <span className="capitalize">{result.source.split('/')[0] || 'ฐานข้อมูล'}</span>
                                                        <span>•</span>
                                                        <span>Match Score: {(result.score * 100).toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`shrink-0 px-3 py-1 rounded-full border text-xs font-semibold ${getScoreColor(result.score)}`}>
                                                {getScoreLabel(result.score)}
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 text-slate-700 leading-relaxed font-serif text-[15px] max-h-64 overflow-y-auto whitespace-pre-wrap">
                                            {result.content}
                                        </div>
                                    </div>
                                ))}
                                
                                <div className="mt-12 p-6 bg-amber-50 border border-amber-200 rounded-2xl flex gap-4 items-start">
                                    <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-amber-800 mb-1">คำเตือนด้านข้อกฎหมาย (Disclaimer)</h4>
                                        <p className="text-sm text-amber-700/80 leading-relaxed">
                                            ผลการค้นหานี้เป็นการจำลองเทียบเคียงข้อมูลด้วย AI (Semantic Search) 
                                            สำหรับการอ้างอิงเพื่อเป็นความรู้เบื้องต้นเท่านั้น ไม่สามารถใช้ทดแทนคำปรึกษาจากทนายความ 
                                            และผลลัพธ์อาจมีความคลาดเคลื่อน หากมีคดีความควรปรึกษาทนายความวิชาชีพโดยตรง
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-16 opacity-50">
                        <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <p className="text-xl font-medium text-slate-400">ค้นหาเพื่อเริ่มต้น</p>
                    </div>
                )}
            </div>
        </div>
    );
}
