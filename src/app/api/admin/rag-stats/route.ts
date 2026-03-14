import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const workerUrl = process.env.NEXT_PUBLIC_RAG_WORKER_URL || 'https://lawslane-rag-api.lawlanes-app.workers.dev';
        const response = await fetch(`${workerUrl}/stats`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            // Add no-store to ensure we get fresh data every time
            cache: 'no-store'
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch stats from Worker' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[RAG Stats Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
