'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Database, RefreshCw, Layers, Cpu, Zap, Activity, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress";

interface RagStats {
    vectorCount?: number;
    dimensions?: number;
    error?: string;
}

export default function RagStatusPage() {
    const [stats, setStats] = useState<RagStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);
    
    // For status tracking
    const [eta, setEta] = useState<string | null>(null);
    const [rate, setRate] = useState<number>(0); // chunks per second
    const [isStalled, setIsStalled] = useState(false);
    const prevCountRef = useRef<number>(0);
    const prevTimeRef = useRef<number>(Date.now());
    const lastSuccessCountTimeRef = useRef<number>(Date.now());

    // Hardcoded estimate based on PDF, Krisdika (140+ years), and Ratchakitcha datasets
    const ESTIMATED_TOTAL_VECTORS = 200000;
    
    // Cloudflare Vectorize Paid Tier limit (10M vectors per index)
    const PAID_TIER_MAX_VECTORS = 10000000;

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin/rag-stats');
            if (res.ok) {
                const data = await res.json();
                const currentCount = data.vectorCount || 0;
                const currentTime = Date.now();

                // Calculate Rate & Stalled State
                if (currentCount > prevCountRef.current) {
                    const deltaCount = currentCount - prevCountRef.current;
                    const deltaTime = (currentTime - prevTimeRef.current) / 1000;
                    const currentRate = deltaCount / deltaTime;
                    
                    setRate(prevRate => prevRate === 0 ? currentRate : prevRate * 0.7 + currentRate * 0.3);
                    lastSuccessCountTimeRef.current = currentTime;
                    setIsStalled(false);
                } else if (currentTime - lastSuccessCountTimeRef.current > 120000) {
                    // If no change for 120 seconds (2 mins), mark as stalled
                    // This accounts for large PDF downloads or data processing gaps
                    setIsStalled(true);
                    setRate(0);
                }

                setStats(data);
                setLastUpdated(currentTime);
                prevCountRef.current = currentCount;
                prevTimeRef.current = currentTime;
            } else {
                setStats(prev => (prev ? { ...prev, error: "Worker Connection Failed" } : { error: "Worker Connection Failed" }));
            }
        } catch (error) {
            console.error("Failed to fetch RAG stats", error);
            setStats(prev => (prev ? { ...prev, error: "Network Error" } : { error: "Network Error" }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!stats || rate <= 0) {
            setEta(null);
            return;
        }

        const remaining = ESTIMATED_TOTAL_VECTORS - (stats.vectorCount || 0);
        if (remaining <= 0) {
            setEta("เสร็จสมบูรณ์");
            return;
        }

        const secondsLeft = remaining / rate;
        
        if (secondsLeft > 3600) {
            const hours = Math.floor(secondsLeft / 3600);
            const mins = Math.floor((secondsLeft % 3600) / 60);
            setEta(`~${hours} ชม. ${mins} น.`);
        } else if (secondsLeft > 60) {
            const mins = Math.floor(secondsLeft / 60);
            setEta(`~${mins} นาทีที่เหลือ`);
        } else {
            setEta("กำลังคำนวณ...");
        }
    }, [stats, rate]);

    useEffect(() => {
        // Initial fetch
        fetchStats();

        // Auto-refresh every 5 seconds
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    const progressValue = Math.min(100, Math.round(((stats?.vectorCount || 0) / ESTIMATED_TOTAL_VECTORS) * 100));

    return (
        <div className="min-h-screen bg-[#020617] p-8 font-sans text-slate-200">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Glowing Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="relative">
                        <div className="absolute -inset-1 blur-lg bg-blue-500/20 rounded-full"></div>
                        <h1 className="relative text-3xl md:text-4xl font-extrabold text-white tracking-tight flex items-center">
                            <Database className="mr-3 h-10 w-10 text-blue-400" />
                            Lawslane <span className="text-blue-400 ml-2">RAG</span>
                        </h1>
                        <p className="text-slate-400 mt-2 font-medium flex items-center gap-2">
                             ระบบปัญญาประดิษฐ์และการนำเข้าข้อมูลกฎหมาย <Activity className="w-4 h-4 text-emerald-400" />
                        </p>
                    </div>
                    <Button 
                        variant="outline" 
                        onClick={() => { setLoading(true); fetchStats(); }}
                        disabled={loading}
                        className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-all rounded-xl px-6 h-12"
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        รีเฟรชระบบ
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Main Stats Card */}
                    <Card className="md:col-span-2 border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Cpu className="w-32 h-32" />
                        </div>
                        <CardHeader className="border-b border-slate-800 pb-4">
                            <CardTitle className="text-white flex items-center text-xl">
                                <Layers className="mr-2 h-5 w-5 text-blue-400" />
                                ฐานข้อมูลองค์ความรู้ (Vector)
                            </CardTitle>
                            <CardDescription className="text-slate-500">
                                สถานะการทำดัชนีข้อมูลแบบ Real-time บน Cloudflare Vectorize
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-8">
                            {loading && !stats ? (
                                <div className="flex flex-col justify-center items-center h-48 space-y-4">
                                    <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                                    <p className="text-sm text-slate-500 animate-pulse">กำลังเชื่อมต่อกับโครงข่ายประสาทเทียม...</p>
                                </div>
                            ) : stats ? (
                                <div className="space-y-10">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">
                                                จำนวนข้อมูลทั้งหมด (Vectors)
                                            </span>
                                            <div className="flex items-baseline gap-4">
                                                <span className="text-6xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                                                    {stats.vectorCount?.toLocaleString() || 0}
                                                </span>
                                                <div className={`flex items-center font-bold text-xs px-3 py-1.5 rounded-full ring-4 transition-all duration-500 ${isStalled ? 'text-amber-400 bg-amber-400/10 border border-amber-400/20 ring-amber-400/5' : 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 ring-emerald-400/5'}`}>
                                                    <span className="relative flex h-2 w-2 mr-2">
                                                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isStalled ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                                                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isStalled ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                                                    </span>
                                                    {isStalled ? 'การนำเข้าหยุดนิ่ง' : 'กำลังนำเข้าข้อมูล'}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* ETA Overlay Box */}
                                        <div className={`border rounded-2xl p-4 flex flex-col items-end transition-all ${isStalled ? 'bg-amber-950/20 border-amber-500/30' : 'bg-blue-950/30 border-blue-500/30'}`}>
                                            <div className={`flex items-center gap-2 mb-1 ${isStalled ? 'text-amber-400' : 'text-blue-400'}`}>
                                                <Clock className="w-4 h-4" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">เวลาโดยประมาณ</span>
                                            </div>
                                            <span className="text-xl font-black text-white">
                                                {isStalled ? 'ติดขัด' : (eta || 'กำลังคำนวณ...')}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono text-right">
                                                {rate > 0 ? `${(rate * 60).toFixed(0)} ชิ้น/นาที` : (isStalled ? 'ไม่มีความเคลื่อนไหว' : 'กำลังวัดความเร็ว...')}
                                            </span>
                                        </div>
                                    </div>

                                    {stats.error && (
                                        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-center gap-3 text-red-400">
                                            <Zap className="w-4 h-4" />
                                            <span className="text-xs font-bold uppercase tracking-wider">ข้อผิดพลาด: {stats.error}</span>
                                        </div>
                                    )}

                                    {/* Estimated Progress */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div className="space-y-1">
                                                <span className="text-sm font-bold text-slate-300">ระยะที่ 1 (Phase 1)</span>
                                                <p className="text-xs text-slate-500">เป้าหมายข้อมูลกฎหมายหลัก (กฤษฎีกา + ราชกิจจานุเบกษา)</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-3xl font-black ${isStalled ? 'text-amber-400' : 'text-blue-400'}`}>
                                                    {progressValue}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden p-1 border border-slate-700 shadow-inner">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-1000 ease-out ${isStalled ? 'bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-gradient-to-r from-blue-600 via-blue-400 to-indigo-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
                                                style={{ width: `${progressValue}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-600 font-mono text-center uppercase tracking-widest">
                                            เป้าหมายระบบ: {ESTIMATED_TOTAL_VECTORS.toLocaleString()} หน่วยองค์ความรู้
                                        </p>
                                    </div>

                                    {/* Infrastructure Capacity */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-800/50">
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                                                <span>ความจุของดัชนี</span>
                                                <span className="text-blue-400">ใช้งานไป {((stats.vectorCount || 0) / PAID_TIER_MAX_VECTORS * 100).toFixed(4)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                                                    style={{ width: `${Math.min(100, ((stats.vectorCount || 0) / PAID_TIER_MAX_VECTORS) * 100)}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-600 font-mono">
                                                {stats.vectorCount?.toLocaleString() || 0} / {PAID_TIER_MAX_VECTORS.toLocaleString()}
                                            </p>
                                        </div>
                                        
                                        <div className="flex items-center gap-6">
                                            <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-700">
                                                <Zap className="w-5 h-5 text-amber-400" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-1">สถาปัตยกรรม</span>
                                                <span className="text-sm font-bold text-slate-200">Neural Lattice (v1.4)</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-800/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,1)]"></div>
                                            <span className="text-xs text-slate-500 uppercase font-bold tracking-tighter">มิติของข้อมูล: {stats.dimensions || 1024}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-slate-600 font-mono uppercase">อัปเดตล่าสุด: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-red-400 p-6 bg-red-950/20 border border-red-900/40 rounded-2xl flex items-center gap-3 shadow-inner">
                                    <Zap className="w-5 h-5" />
                                    <p className="text-sm font-bold">ข้อผิดพลาด: ไม่สามารถระบุข้อมูลสถิติของดัชนีได้</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Terminal Tasks Sidebar */}
                    <div className="space-y-4">
                        <div className="px-2">
                             <h2 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center">
                                <Cpu className="w-4 h-4 mr-2" /> งานเบื้องหลังที่รันอยู่
                             </h2>
                        </div>
                        
                        <div className="space-y-3">
                            {[
                                { title: "นำเข้าไฟล์ PDF", cmd: "ingest-to-cloudflare.ts", color: "bg-blue-500", count: "182 ไฟล์" },
                                { title: "ราชกิจจาฯ 20-25", cmd: "ingest-ratchakitcha.py", color: "bg-purple-500" },
                                { title: "ราชกิจจาฯ ย้อนหลัง", cmd: "ingest-ratchakitcha-historical.py", color: "bg-indigo-500" },
                                { title: "กฤษฎีกา (Krisdika)", cmd: "ingest-krisdika.py", color: "bg-teal-500" }
                            ].map((task, i) => (
                                <div key={i} className="group p-4 rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/40 transition-all border-l-4" style={{ borderColor: i === 0 ? '#3b82f6' : i === 1 ? '#a855f7' : i === 2 ? '#6366f1' : '#14b8a6' }}>
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-white text-xs">{task.title} {task.count && <span className="text-slate-500 font-normal ml-1">({task.count})</span>}</h3>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 shadow-inner">
                                            <div className={`w-1.5 h-1.5 rounded-full ${task.color} animate-pulse`}></div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase">กำลังรัน</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-mono truncate opacity-60 group-hover:opacity-100 transition-opacity">{task.cmd}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 p-4 bg-blue-950/10 border border-blue-900/30 rounded-2xl">
                             <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">บันทึกภายใน</h4>
                             <p className="text-xs text-slate-500 leading-relaxed italic">
                                "โครงข่ายกฎหมายกำลังขยายตัว ความแม่นยำในการค้นหาจะเพิ่มขึ้นตามความหนาแน่นของข้อมูล"
                             </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
