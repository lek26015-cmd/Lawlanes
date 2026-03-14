'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Loader2, AlertTriangle, CheckCircle, Info, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { analyzeContract, ContractAnalysisResult } from '@/app/actions/contract-analyzer-actions';

export default function AnalyzeContractPage() {
    const t = useTranslations('common');
    const [contractText, setContractText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<ContractAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        if (!contractText.trim()) return;

        setIsAnalyzing(true);
        setError(null);
        setResult(null);

        try {
            const data = await analyzeContract(contractText);
            setResult(data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'เกิดข้อผิดพลาดในการวิเคราะห์สัญญา กรุณาลองใหม่อีกครั้ง');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getSeverityDetails = (severity: string) => {
        switch (severity.toLowerCase()) {
            case 'high':
                return { icon: <ShieldAlert className="w-5 h-5 text-red-600" />, color: 'text-red-700 bg-red-50 border-red-200', label: 'ความเสี่ยงสูง (ควรหลีกเลี่ยง)' };
            case 'medium':
                return { icon: <AlertTriangle className="w-5 h-5 text-amber-600" />, color: 'text-amber-700 bg-amber-50 border-amber-200', label: 'ความเสี่ยงปานกลาง (ควรเจรจาต่อรอง)' };
            case 'low':
                return { icon: <Info className="w-5 h-5 text-blue-600" />, color: 'text-blue-700 bg-blue-50 border-blue-200', label: 'ข้อสังเกตทั่วไป' };
            default:
                return { icon: <Info className="w-5 h-5 text-slate-600" />, color: 'text-slate-700 bg-slate-50 border-slate-200', label: severity };
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] py-12 px-4 md:px-8">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center p-4 bg-indigo-50 rounded-2xl mb-2">
                        <FileText className="w-10 h-10 text-indigo-600" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
                        ระบบตรวจสอบสัญญาด้วย AI
                    </h1>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                        วางข้อความสัญญาที่คุณต้องการตรวจสอบ AI จะทำการดึงข้อกฎหมายที่เกี่ยวข้องมาวิเคราะห์ความได้เปรียบเสียเปรียบและจุดที่ควรระวัง
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Input Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
                        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-slate-400" /> ข้อความสัญญา
                            </h2>
                            <span className="text-xs text-slate-400 font-mono">{contractText.length} / 15000 chars</span>
                        </div>
                        <div className="p-6 flex-1 flex flex-col">
                            <Textarea
                                placeholder="วางเนื้อหาสัญญา หรือ เงื่อนไขการให้บริการที่คุณต้องการตรวจสอบที่นี่..."
                                className="flex-1 w-full resize-none border-none focus-visible:ring-0 shadow-none text-base leading-relaxed bg-transparent p-0"
                                value={contractText}
                                onChange={(e) => setContractText(e.target.value)}
                                maxLength={15000}
                            />
                        </div>
                        <div className="border-t border-slate-100 p-6 bg-white">
                            <Button 
                                onClick={handleAnalyze} 
                                disabled={isAnalyzing || contractText.length < 50}
                                className="w-full h-14 text-lg rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                        กำลังให้ AI วิเคราะห์ข้อกฎหมาย...
                                    </>
                                ) : (
                                    'วิเคราะห์สัญญา'
                                )}
                            </Button>
                            {contractText.length > 0 && contractText.length < 50 && (
                                <p className="text-amber-600 text-sm mt-3 text-center">
                                    กรุณาใส่ข้อความสัญญาให้ยาวกว่านี้ (ขั้นต่ำ 50 ตัวอักษร)
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Results Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[600px] flex flex-col">
                        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-indigo-500" /> ผลการวิเคราะห์จาก AI
                            </h2>
                        </div>
                        
                        <div className="p-6 flex-1 overflow-y-auto">
                            {!isAnalyzing && !result && !error && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                                    <ShieldAlert className="w-16 h-16 opacity-20" />
                                    <p className="text-center">ผลการวิเคราะห์ ข้อควรระวัง<br/>และจุดที่เกี่ยวข้องกับกฎหมายจะแสดงที่นี่</p>
                                </div>
                            )}

                            {error && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 font-medium flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <p>{error}</p>
                                </div>
                            )}

                            {result && (
                                <div className="space-y-8 pb-8">
                                    {/* Summary */}
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">ภาพรวมสัญญา</h3>
                                        <p className="text-slate-700 leading-relaxed font-medium">
                                            {result.summary}
                                        </p>
                                    </div>

                                    {/* Keywords */}
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">คีย์เวิร์ดกฎหมายที่ค้นพบ</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {result.keywords.map((kw, idx) => (
                                                <span key={idx} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-100">
                                                    {kw}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Observations */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">จุดสังเกตและความเสี่ยง ({result.observations.length})</h3>
                                        
                                        {result.observations.length === 0 ? (
                                            <p className="text-emerald-600 bg-emerald-50 p-4 rounded-xl border border-emerald-200 font-medium">
                                                ไม่พบจุดเสี่ยงที่ร้ายแรงในเนื้อหาสัญญานี้
                                            </p>
                                        ) : (
                                            <div className="space-y-4">
                                                {result.observations.map((obs, idx) => {
                                                    const severityConf = getSeverityDetails(obs.severity);
                                                    return (
                                                        <div key={idx} className={`p-5 rounded-2xl border ${severityConf.color}`}>
                                                            <div className="flex items-start gap-3 mb-3">
                                                                <div className="mt-0.5">{severityConf.icon}</div>
                                                                <div>
                                                                    <h4 className="font-bold text-slate-900">{obs.issue}</h4>
                                                                    <span className="text-xs font-semibold opacity-80">{severityConf.label}</span>
                                                                </div>
                                                            </div>
                                                            <p className="text-sm opacity-90 leading-relaxed mb-3">
                                                                {obs.explanation}
                                                            </p>
                                                            {obs.citedLaw && (
                                                                <div className="mt-3 pt-3 border-t border-current/20">
                                                                    <p className="text-sm font-serif">
                                                                        <span className="font-semibold">อ้างอิงกฎหมาย:</span> {obs.citedLaw}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="pt-4 border-t border-slate-200">
                                        <p className="text-xs text-slate-400 italic text-center">
                                            ข้อมูลนี้ประมวลผลโดย AI เพื่อใช้เป็นแนวทางเบื้องต้น ไม่นับเป็นการให้คำปรึกษาทางกฎหมายโดยทนายความวิชาชีพ
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
