import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';

/**
 * SSO ข้าม subdomain: มี session cookie (.lawslane.com) แต่ Firebase Client SDK ของโดเมนนี้ยังไม่มีผู้ใช้
 * (เช่น ล็อกอินมาจาก wittaya.lawslane.com) — แลก session cookie เป็น custom token ให้ client
 * signInWithCustomToken ต่อ
 *
 * เดิม client-provider ค้างสถานะ isUserLoading=true ตลอดไปในกรณีนี้ → header ไม่แสดงทั้งปุ่ม login และเมนูบัญชี
 */
export async function POST(request: Request) {
    // กันเว็บอื่นยิงข้ามโดเมน — fetch แบบ same-origin ส่ง Origin ตรงกับ Host เสมอ
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
        try {
            if (new URL(origin).host !== host) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        } catch {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    const unauthenticated = () => {
        // session_hint ค้างแต่ session ใช้ไม่ได้แล้ว — ลบทิ้ง ไม่ให้ทุกหน้ายิงมาที่นี่ซ้ำ
        const domain = process.env.NODE_ENV === 'production'
            ? `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'lawslane.com'}`
            : undefined;
        cookieStore.delete({ name: 'session_hint', path: '/', ...(domain ? { domain } : {}) });
        return NextResponse.json({ authenticated: false }, { status: 401 });
    };

    if (!sessionCookie) return unauthenticated();

    try {
        const admin = await initAdmin();
        if (!admin) return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });

        let uid: string;
        try {
            // checkRevoked: ออกจากระบบ/เปลี่ยนรหัสผ่านที่อื่นแล้ว session นี้ต้องใช้ไม่ได้
            uid = (await admin.auth().verifySessionCookie(sessionCookie, true)).uid;
        } catch {
            return unauthenticated();
        }

        const customToken = await admin.auth().createCustomToken(uid);
        return NextResponse.json({ customToken });
    } catch (error) {
        console.error('Session token exchange failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
