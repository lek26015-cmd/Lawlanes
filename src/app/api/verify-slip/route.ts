import { NextResponse } from 'next/server';
import { requireUser, authErrorResponse } from '@/lib/auth-guard';


export async function POST(request: Request) {
    // ต้องล็อกอินอยู่จริง — เดิมเปิดให้ทุกคนเรียก จึงเป็น proxy ฟรีที่เผาโควตา SlipOK
    try {
        await requireUser();
    } catch (e) {
        return authErrorResponse(e);
    }
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

        // คีย์ SlipOK ต้องมาจาก env เท่านั้น — เดิม hardcode ไว้ในซอร์สของ repo ที่เป็น public
        const slipOkKey = process.env.SLIPOK_API_KEY;
        if (!slipOkKey) {
            console.error('SLIPOK_API_KEY is not configured');
            return NextResponse.json(
                { success: false, message: 'Slip verification is not configured' },
                { status: 503 }
            );
        }

        const response = await fetch('https://api.slipok.com/api/check/slip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-authorization': slipOkKey,
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
