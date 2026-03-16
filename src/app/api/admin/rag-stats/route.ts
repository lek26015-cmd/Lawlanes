import { NextResponse } from 'next/server';

// Simple server-side cache to prevent rate limiting Cloudflare Workers
// Initializing with last known good count (from 36h logs) to prevent 0% on cold start
let cachedData: any = { vectorCount: 188053, dimensions: 1024, lastChecked: new Date().toISOString() };
let lastCacheTime = Date.now();
const CACHE_DURATION = 30000; // 30 seconds to be very safe

export async function GET() {
    try {
        const now = Date.now();
        
        // Return cached data if valid
        if (cachedData && (now - lastCacheTime < CACHE_DURATION)) {
            return NextResponse.json(cachedData);
        }

        const workerUrl = process.env.NEXT_PUBLIC_RAG_WORKER_URL || 'https://lawslane-rag-api.lawlanes-app.workers.dev';
        const response = await fetch(`${workerUrl}/stats`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store'
        });

        if (!response.ok) {
            // If rate limited, return previous cache if exists even if expired
            if (cachedData) return NextResponse.json(cachedData);
            return NextResponse.json({ error: 'Failed to fetch stats from Worker' }, { status: response.status });
        }

        const data = await response.json();
        
        // Update cache
        cachedData = data;
        lastCacheTime = now;
        
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[RAG Stats Error]', error);
        if (cachedData) return NextResponse.json(cachedData);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
