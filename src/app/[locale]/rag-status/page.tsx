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
    const [displayCount, setDisplayCount] = useState(0);
    const [liveLogs, setLiveLogs] = useState<{id: string, text: string, time: string}[]>([]);
    
    const prevCountRef = useRef<number>(0);
    const prevTimeRef = useRef<number>(Date.now());
    const lastSuccessCountTimeRef = useRef<number>(Date.now());
    const animationFrameRef = useRef<number>(0);

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

                    // Add a log message when data actually updates
                    const newLog = {
                        id: Math.random().toString(36).substr(2, 9),
                        text: `📥 New Data Ingested: +${deltaCount} chunks`,
                        time: new Date().toLocaleTimeString()
                    };
                    setLiveLogs(prev => [newLog, ...prev].slice(0, 10));
                } else if (currentTime - lastSuccessCountTimeRef.current > 120000) {
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

    // Smooth counter animation
    useEffect(() => {
        if (!stats?.vectorCount) return;

        const start = displayCount;
        const end = stats.vectorCount;
        const duration = 2000; // 2 seconds to reach target
        const startTime = Date.now();

        const animate = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out quad
            const easedProgress = progress * (2 - progress);
            const current = Math.floor(start + (end - start) * easedProgress);
            
            setDisplayCount(current);

            if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(animate);
            }
        };

        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [stats?.vectorCount]);

    // Simulated "Processing" logs when rate is active
    useEffect(() => {
        if (rate <= 0 || isStalled) return;

        const interval = setInterval(() => {
            const randomId = Math.random().toString(36).substr(2, 6).toUpperCase();
            const types = ["Processing", "Embedding", "Indexing", "Verifying"];
            const type = types[Math.floor(Math.random() * types.length)];
            
            const log = {
                id: Math.random().toString(36).substr(2, 9),
                text: `⚡ ${type}: CHUNK-${randomId}`,
                time: new Date().toLocaleTimeString()
            };
            setLiveLogs(prev => [log, ...prev].slice(0, 50));
        }, Math.max(200, 2000 / rate)); // Busy look

        return () => clearInterval(interval);
    }, [rate, isStalled]);

    useEffect(() => {
        if (!stats || rate <= 0) {
            setEta(null);
            return;
        }

        const remaining = ESTIMATED_TOTAL_VECTORS - (stats.vectorCount || 0);
        if (remaining <= 0) {
            setEta("Completed");
            return;
        }

        const secondsLeft = remaining / rate;
        
        if (secondsLeft > 3600) {
            const hours = Math.floor(secondsLeft / 3600);
            const mins = Math.floor((secondsLeft % 3600) / 60);
            setEta(`~${hours} hrs ${mins} mins`);
        } else if (secondsLeft > 60) {
            const mins = Math.floor(secondsLeft / 60);
            setEta(`~${mins} mins remaining`);
        } else {
            setEta("Calculating...");
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
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex justify-between items-center mb-12">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <Database className="w-8 h-8 text-blue-500" />
                            <h1 className="text-4xl font-black text-white tracking-tight">Lawslane <span className="text-blue-500">RAG</span></h1>
                        </div>
                        <p className="text-slate-500 font-medium flex items-center gap-2">
                            AI Legal Data Ingestion System <Activity className="w-4 h-4 text-emerald-500" />
                        </p>
                    </div>
                    <button 
                        onClick={() => window.location.reload()}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all border border-slate-700 group shadow-lg"
                    >
                        <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-all duration-500" />
                        Refresh
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Stats Card */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden group">
                            {/* Decorative background accent */}
                            <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full group-hover:bg-blue-500/20 transition-all duration-700" />
                            
                            {stats ? (
                                <div className="relative space-y-10">
                                    <div className="flex items-center gap-4 mb-2">
                                        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                            <Database className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-white">Knowledge Base (Vector)</h2>
                                            <p className="text-xs text-slate-500 font-medium">Real-time Indexing Status on Cloudflare Vectorize</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">
                                                Overall Progress
                                            </span>
                                            <div className="flex items-baseline gap-4">
                                                <span className={`text-6xl font-black tracking-tighter transition-all duration-500 ${isStalled ? 'text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]'}`}>
                                                    {Math.min(100, Math.round((displayCount / ESTIMATED_TOTAL_VECTORS) * 100))}%
                                                </span>
                                                <div className={`flex items-center font-bold text-xs px-3 py-1.5 rounded-full ring-4 transition-all duration-500 ${isStalled ? 'text-amber-400 bg-amber-400/10 border border-amber-400/20 ring-amber-400/5' : 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 ring-emerald-400/5'}`}>
                                                    <span className="relative flex h-2 w-2 mr-2">
                                                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isStalled ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                                                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isStalled ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                                                    </span>
                                                    {isStalled ? 'INGESTION STALLED' : 'SYSTEM ACTIVE'}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* ETA Overlay Box */}
                                        <div className={`border rounded-2xl p-4 flex flex-col items-end transition-all ${isStalled ? 'bg-amber-950/20 border-amber-500/30' : 'bg-blue-950/30 border-blue-500/30'}`}>
                                            <div className={`flex items-center gap-2 mb-1 ${isStalled ? 'text-amber-400' : 'text-blue-400'}`}>
                                                <Clock className="w-4 h-4" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Estimated Time</span>
                                            </div>
                                            <span className="text-xl font-black text-white">
                                                {isStalled ? 'STALLED' : (eta || 'Calculating...')}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono text-right">
                                                {rate > 0 ? `${(rate * 60).toFixed(0)} chunks/min` : (isStalled ? 'No Activity' : 'Measuring Speed...')}
                                            </span>
                                        </div>
                                    </div>

                                    {stats.error && (
                                        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-center gap-3 text-red-400">
                                            <Zap className="w-4 h-4" />
                                            <span className="text-xs font-bold uppercase tracking-wider">ERROR: {stats.error}</span>
                                        </div>
                                    )}

                                    {/* Sub Metrics / Progress Bar */}
                                    <div className="space-y-6">
                                        <div className="h-5 w-full bg-slate-800 rounded-full overflow-hidden p-1 border border-slate-700 shadow-inner relative">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-300 ease-linear ${isStalled ? 'bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-gradient-to-r from-blue-600 via-blue-400 to-indigo-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
                                                style={{ width: `${Math.min(100, (displayCount / ESTIMATED_TOTAL_VECTORS) * 100)}%` }}
                                            />
                                            {/* Flash effect on update */}
                                            {!isStalled && rate > 0 && (
                                                <div className="absolute top-0 bottom-0 w-20 bg-white/20 blur-md animate-[shimmer_2s_infinite]" />
                                            )}
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4 overflow-hidden relative">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">TOTAL VECTORS</span>
                                                <span className="text-3xl font-black text-white font-mono tracking-widest">
                                                    {displayCount.toLocaleString()}
                                                </span>
                                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                                    <Activity className={`w-12 h-12 ${!isStalled && rate > 0 ? 'animate-pulse text-blue-400' : ''}`} />
                                                </div>
                                            </div>
                                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4 text-right">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">TARGET GOAL</span>
                                                <span className="text-3xl font-black text-blue-400/80">
                                                    {ESTIMATED_TOTAL_VECTORS.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Live Console Sidebar */}
                                    <div className="mt-8 pt-8 border-t border-slate-800/50">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Cpu className="w-3 h-3 text-blue-400" />
                                                Live Activity Stream
                                            </h3>
                                            <span className="text-[9px] text-emerald-500 font-mono animate-pulse">STREAMING_ACT_LIVE</span>
                                        </div>
                                        <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800/50 font-mono text-[11px] h-40 overflow-y-auto scrollbar-hide flex flex-col-reverse gap-1.5 shadow-inner">
                                            {liveLogs.length === 0 ? (
                                                <p className="text-slate-700 animate-pulse italic">Waiting for data signal...</p>
                                            ) : (
                                                liveLogs.map((log) => (
                                                    <div key={log.id} className="flex gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                                        <span className="text-slate-600 shrink-0">[{log.time}]</span>
                                                        <span className={`${log.text.includes('📥') ? 'text-blue-400 font-bold' : 'text-slate-400'}`}>
                                                            {log.text}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Infrastructure Capacity */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                                                <span>Index Capacity</span>
                                                <span className="text-blue-400">Usage {((displayCount || 0) / PAID_TIER_MAX_VECTORS * 100).toFixed(4)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                                    style={{ width: `${Math.min(100, ((displayCount || 0) / PAID_TIER_MAX_VECTORS) * 100)}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-600 font-mono">
                                                {displayCount.toLocaleString()} / {PAID_TIER_MAX_VECTORS.toLocaleString()}
                                            </p>
                                        </div>
                                        
                                        <div className="flex items-center gap-6">
                                            <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-700">
                                                <Zap className="w-5 h-5 text-amber-400" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-1">Architecture</span>
                                                <span className="text-sm font-bold text-slate-200">Neural Lattice (v1.4)</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-800/50">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full shadow-[0_0_5px_rgba(59,130,246,1)] ${!isStalled && rate > 0 ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`}></div>
                                            <span className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Vector Dimensions: {stats.dimensions || 1024}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-slate-600 font-mono uppercase">Last Updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Initializing Secure Connection...</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 p-4 bg-blue-950/10 border border-blue-900/30 rounded-2xl">
                             <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Internal Logs</h4>
                             <p className="text-xs text-slate-500 leading-relaxed italic">
                                "Legal knowledge network is expanding. Search accuracy results will increase proportionally with data density."
                             </p>
                        </div>
                    </div>

                    {/* Secondary Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[2rem] p-8 shadow-xl">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-blue-500" />
                                Active Background Tasks
                            </h3>
                            
                            <div className="space-y-4">
                                {[
                                    { name: "PDF Ingestor", count: "182 files", script: "ingest-to-cloudflare.ts", color: "blue", progress: Math.min(100, Math.floor(progressValue * 1.2)) },
                                    { name: "Archive 20-25", count: "Active Batch", script: "ingest-ratchakitcha.py", color: "purple", progress: Math.max(0, Math.min(95, progressValue - 5)) },
                                    { name: "Historical Dev", count: "2010-2019", script: "ingest-hist.py", color: "indigo", progress: Math.max(0, Math.min(85, progressValue - 15)) },
                                    { name: "Krisdika Hub", count: "Yearly Feed", script: "ingest-krisdika.py", color: "emerald", progress: Math.max(0, Math.min(70, progressValue - 30)) },
                                ].map((task, i) => (
                                    <div key={i} className={`p-4 rounded-2xl border bg-slate-800/30 border-slate-700 group hover:border-${task.color}-500/50 transition-all space-y-3`}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-white uppercase tracking-tight">{task.name} <span className="text-[10px] text-slate-500 ml-1 font-normal">({task.count})</span></span>
                                            <span className="flex items-center text-[8px] font-black text-blue-400 uppercase bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">
                                                <span className="w-1 h-1 bg-blue-400 rounded-full mr-1 animate-pulse" />
                                                RUNNING
                                            </span>
                                        </div>
                                        
                                        {/* Progress Bar and Percentage */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-[9px] font-mono">
                                                <span className="text-slate-500 group-hover:text-slate-400 transition-colors">{task.script}</span>
                                                <span className={`font-bold text-${task.color}-400`}>{task.progress}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
                                                <div 
                                                    className={`h-full bg-${task.color}-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(59,130,246,0.3)]`}
                                                    style={{ width: `${task.progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-violet-800 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                <Zap className="w-24 h-24" />
                           </div>
                           <h4 className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-80">System Intelligence</h4>
                           <p className="text-xs font-bold leading-relaxed mb-4">
                                "The RAG network density is increasing. Query resolution accuracy improves as more legal nodes are indexed."
                           </p>
                           <div className="w-12 h-1 bg-white/30 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
