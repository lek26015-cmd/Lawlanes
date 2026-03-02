import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { data } = body;

        if (!data) {
            return NextResponse.json(
                { success: false, message: 'No QR data provided' },
                { status: 400 }
            );
        }

        // NOTE: firebase-admin tracking removed for Edge compatibility.
        // If usage tracking is needed, it should be moved to a separate Cloudflare Worker
        // or using a client-side Firestore call (with proper security rules).

        const response = await fetch('https://api.slipok.com/api/check/slip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-authorization': 'SLIPOKAKIAD90',
            },
            body: JSON.stringify({ data: data }),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('SlipOK API Error:', result);
            return NextResponse.json(
                { success: false, message: result.message || 'Verification failed' },
                { status: response.status }
            );
        }

        return NextResponse.json({ success: true, data: result.data });
    } catch (error) {
        console.error('Slip Verification Error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
