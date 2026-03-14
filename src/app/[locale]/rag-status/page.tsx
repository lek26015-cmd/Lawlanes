'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Database, RefreshCw, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress";

export default function RagStatusPage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Hardcoded estimate based on PDF and Ratchakitcha dataset chunks
    const ESTIMATED_TOTAL_VECTORS = 20000;
    
    // Cloudflare Vectorize Paid Tier limit (10M vectors per index)
    const PAID_TIER_MAX_VECTORS = 10000000;

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin/rag-stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error("Failed to fetch RAG stats", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchStats();

        // Auto-refresh every 5 seconds
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-[#F4F6F9] p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-[#0B3979] flex items-center">
                            <Database className="mr-3 h-8 w-8 text-blue-600" />
                            RAG Ingestion Dashboard
                        </h1>
                        <p className="text-slate-500 mt-2">
                            Monitor the real-time progress of documents being ingested into the Vectorize Database.
                        </p>
                    </div>
                    <Button 
                        variant="outline" 
                        onClick={() => { setLoading(true); fetchStats(); }}
                        disabled={loading}
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh Now
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-none shadow-lg">
                        <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4">
                            <CardTitle className="text-blue-900 flex items-center">
                                <Layers className="mr-2 h-5 w-5" />
                                Vector Database Status
                            </CardTitle>
                            <CardDescription>
                                Current state of the Cloudflare Vectorize Index
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {loading && !stats ? (
                                <div className="flex justify-center items-center h-32">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                </div>
                            ) : stats ? (
                                <div className="space-y-6">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">
                                            Total Vectors (Chunks)
                                        </span>
                                        <div className="flex items-baseline">
                                            <span className="text-5xl font-extrabold text-[#0B3979]">
                                                {stats.vectorCount?.toLocaleString() || 0}
                                            </span>
                                            <span className="ml-2 text-green-600 font-medium text-sm flex items-center bg-green-50 px-2 py-1 rounded-md">
                                                <span className="relative flex h-2 w-2 mr-2">
                                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                </span>
                                                Live Updating
                                            </span>
                                        </div>
                                    </div>

                                    {/* Estimated Progress Bar */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-sm font-medium text-slate-700">Estimated Progress</span>
                                            <span className="font-bold text-[#0B3979]">
                                                {Math.min(100, Math.round(((stats.vectorCount || 0) / ESTIMATED_TOTAL_VECTORS) * 100))}%
                                            </span>
                                        </div>
                                        <Progress value={Math.min(100, Math.round(((stats.vectorCount || 0) / ESTIMATED_TOTAL_VECTORS) * 100))} className="h-3 [&>div]:bg-[#0B3979]" />
                                        <p className="text-xs text-slate-500 text-right">
                                            Based on estimated goal of {ESTIMATED_TOTAL_VECTORS.toLocaleString()} chunks
                                        </p>
                                    </div>

                                    {/* Storage Bar (10M Limit) */}
                                    <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                                        <div className="flex justify-between items-end">
                                            <span className="text-sm font-medium text-slate-700">Vector Database Capacity (Paid Plan)</span>
                                            <span className="font-bold text-emerald-600">
                                                {((stats.vectorCount || 0) / PAID_TIER_MAX_VECTORS * 100).toFixed(4)}%
                                            </span>
                                        </div>
                                        <Progress value={Math.min(100, ((stats.vectorCount || 0) / PAID_TIER_MAX_VECTORS) * 100)} className="h-3 [&>div]:bg-emerald-500" />
                                        <div className="flex justify-between items-center text-xs text-slate-500">
                                            <span>
                                                {stats.vectorCount?.toLocaleString() || 0} / {PAID_TIER_MAX_VECTORS.toLocaleString()} chunks
                                            </span>
                                            <span className="text-emerald-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis pl-2">
                                                Massive capacity available
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                        <div>
                                            <span className="text-sm text-slate-500 block">Dimensions</span>
                                            <span className="font-semibold text-slate-800">{stats.dimensions || 1024}</span>
                                        </div>
                                        <div>
                                            <span className="text-sm text-slate-500 block">Last Updated</span>
                                            <span className="font-semibold text-slate-800 text-sm">
                                                {lastUpdated ? lastUpdated.toLocaleTimeString() : '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-red-500 p-4 bg-red-50 rounded-lg border border-red-100">
                                    Failed to load database statistics.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-lg">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-slate-800">Terminal Tasks running</CardTitle>
                            <CardDescription>Background processes adding to the database</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                <h3 className="font-semibold text-slate-800 text-sm mb-1">PDF Ingestion (182 files)</h3>
                                <p className="text-xs text-slate-500 mb-3">npx tsx scripts/ingest-to-cloudflare.ts</p>
                                <div className="flex items-center text-xs font-medium text-blue-700 bg-blue-100 w-fit px-2 py-1 rounded">
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" /> In Progress
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                                <h3 className="font-semibold text-slate-800 text-sm mb-1">Ratchakitcha Dataset (2020-2025)</h3>
                                <p className="text-xs text-slate-500 mb-3">python3 scripts/ingest-ratchakitcha.py</p>
                                <div className="flex items-center text-xs font-medium text-purple-700 bg-purple-100 w-fit px-2 py-1 rounded">
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" /> In Progress
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                                <h3 className="font-semibold text-slate-800 text-sm mb-1">Ratchakitcha Historical (2010-2019)</h3>
                                <p className="text-xs text-slate-500 mb-3">python3 scripts/ingest-ratchakitcha-historical.py</p>
                                <div className="flex items-center text-xs font-medium text-indigo-700 bg-indigo-100 w-fit px-2 py-1 rounded">
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" /> In Progress
                                </div>
                            </div>
                            
                            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-teal-500"></div>
                                <h3 className="font-semibold text-slate-800 text-sm mb-1">Krisdika Acts (1877-Present)</h3>
                                <p className="text-xs text-slate-500 mb-3">python3 scripts/ingest-krisdika.py</p>
                                <div className="flex items-center text-xs font-medium text-teal-700 bg-teal-100 w-fit px-2 py-1 rounded">
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" /> In Progress
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
