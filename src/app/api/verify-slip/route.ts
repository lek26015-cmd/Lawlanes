import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';
import { requireUser, authErrorResponse } from '@/lib/auth-guard';
import { slipTransRefDocId } from '@/lib/slip-verification';

/**
 * ตรวจสลิปกับ SlipOK แล้ว **เก็บผลไว้ฝั่ง server**
 *
 * ของเดิมส่งผลตรวจกลับไปให้เบราว์เซอร์อย่างเดียว แล้ว client ส่ง `slipOkData`
 * ก้อนนั้นกลับมาให้ server action ใช้ตัดสินว่า "จ่ายแล้วหรือยัง" ซึ่งแปลว่า
 * ใครก็ยิง action พร้อม slipOkData ปลอมแล้วได้สถานะ paid ฟรี
 *
 * ตอนนี้ผลตรวจถูกเขียนลง `slipVerifications` พร้อม uid ของคนตรวจ และคืนแค่
 * `verificationId` ไปให้ client ถือ — ตอนชำระเงินจริง server จะไปอ่านเอกสารนี้เอง
 * (ดู readSlipVerificationInTx() ใน lib/slip-verification.ts) client ปลอมอะไรไม่ได้เลย
 *
 * เอกสารแต่ละใบใช้ได้ครั้งเดียว และ transRef หนึ่งค่าถูกจองได้ครั้งเดียว
 * (slipTransRefs) ตอนใช้ตั๋ว — กันเอาสลิปใบเดิมไปจ่ายหลายรายการ ส่วนการเช็คซ้ำ
 * ตรงนี้มีไว้บอกผู้ใช้ให้เร็วขึ้นเท่านั้น
 */
export async function POST(request: Request) {
    // ต้องล็อกอินอยู่จริง — เดิมเปิดให้ทุกคนเรียก จึงเป็น proxy ฟรีที่เผาโควตา SlipOK
    let uid: string;
    try {
        ({ uid } = await requireUser());
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

        const slip = result.data ?? {};
        const amount = Number(slip.amount);
        const transRef: string = slip.transRef || slip.transRefNo || '';

        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                { success: false, message: 'สลิปนี้ไม่มียอดเงินที่อ่านได้' },
                { status: 400 }
            );
        }

        const adminApp = await initAdmin();
        if (!adminApp) {
            return NextResponse.json({ success: false, message: 'ระบบยังไม่พร้อม' }, { status: 503 });
        }
        const db = adminApp.firestore();

        // สลิปใบเดิมใช้ซ้ำไม่ได้ — ด่านนี้เป็นแค่ UX (บอกผู้ใช้เร็วๆ ก่อนกดชำระ)
        // ตัวชี้ขาดจริงคือการจอง slipTransRefs ใน transaction ตอนใช้ตั๋ว
        // (readSlipVerificationInTx) เพราะเช็คตรงนี้ก่อนออกตั๋ว ยิงพร้อมกันก็ผ่านหมด
        const transRefId = slipTransRefDocId(transRef);
        if (transRefId) {
            const [reserved, dup] = await Promise.all([
                db.collection('slipTransRefs').doc(transRefId).get(),
                db
                    .collection('slipVerifications')
                    .where('transRef', '==', transRef)
                    .where('consumed', '==', true)
                    .limit(1)
                    .get(),
            ]);
            if (reserved.exists || !dup.empty) {
                return NextResponse.json(
                    { success: false, message: 'สลิปใบนี้ถูกใช้ชำระเงินไปแล้ว' },
                    { status: 409 }
                );
            }
        }

        const verificationRef = db.collection('slipVerifications').doc();
        await verificationRef.set({
            uid,
            amount,
            transRef: transRef || null,
            slipData: slip,
            consumed: false,
            createdAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({
            success: true,
            verificationId: verificationRef.id,
            // ส่งกลับแค่ที่หน้าเว็บต้องใช้แสดงผล ไม่ใช่ตั๋วที่ใช้อ้างสิทธิ์ได้
            data: { amount, transRef: transRef || null },
        });
    } catch (error) {
        console.error('Slip Verification Error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
