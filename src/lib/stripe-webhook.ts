import type Stripe from 'stripe';

/**
 * helper กลางของ webhook Stripe (PLAN-08 "helper กลาง") — คัดลอกไว้ทุก repo ให้หน้าตาเหมือนกัน
 *
 * ลำดับ: ตรวจลายเซ็น → กรอง product → จอง event → ประมวลผล → พลาดให้ปล่อยตัวจอง (Stripe จะ retry)
 * ที่นี่จอง event ใน transaction เดียวกับการบันทึกแพลน (isEventClaimedTx + claimEventTx) — ถ้า transaction ล้ม
 * ตัวจองก็ไม่ถูกเขียน เท่ากับปล่อยตัวจองอัตโนมัติ
 *
 * collection ตัวจองต้องแยกต่อเว็บ: CapDeal ใช้ `stripe_events` และได้ event id ชุดเดียวกัน
 * (บัญชี Stripe เดียวกัน) ถ้าใช้ collection เดียวกัน endpoint หนึ่งจะทำให้อีกฝั่งข้าม event ว่าซ้ำ
 *
 * ไฟล์นี้ไม่มี Admin SDK / ไม่เรียก Stripe API — import ได้ในเทสต์
 */

/** ลายเซ็นมี timestamp — ตั้ง tolerance 5 นาที กันการส่ง event เก่าซ้ำ */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

/** ตรวจลายเซ็นกับ raw body — ไม่ผ่าน = null (ตอบ 400) */
export function verifyStripeEvent(stripe: Stripe, rawBody: string, signature: string | null, secret: string): Stripe.Event | null {
    if (!signature) return null;
    try {
        return stripe.webhooks.constructEvent(rawBody, signature, secret, WEBHOOK_TOLERANCE_SECONDS);
    } catch {
        return null;
    }
}

/** อายุตัวจอง — ตั้ง TTL policy ใน Firestore ที่ฟิลด์ expiresAt (Stripe retry ไม่เกิน 3 วัน) */
const MARKER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** อ่านตัวจองใน transaction — มีอยู่แล้ว = ประมวลผลไปแล้ว ให้ข้าม (อ่านก่อน แล้วค่อยเขียนด้วย claimEventTx) */
export async function isEventClaimedTx(tx: FirebaseFirestore.Transaction, marker: FirebaseFirestore.DocumentReference): Promise<boolean> {
    return (await tx.get(marker)).exists;
}

/**
 * เขียนตัวจองใน transaction เดียวกับการให้สิทธิ์ — เรียกหลังอ่านครบแล้ว (Firestore ให้อ่านทั้งหมดก่อนเขียน)
 * ใช้ create: ถ้ามี request อื่นจองไปพร้อมกัน transaction นี้จะล้ม/retry แล้วเห็นว่าจองแล้ว
 */
export function claimEventTx(
    tx: FirebaseFirestore.Transaction,
    marker: FirebaseFirestore.DocumentReference,
    event: Pick<Stripe.Event, 'id' | 'type'>,
): void {
    const now = Date.now();
    // เก็บแค่ชนิด event และเวลา — ไม่เก็บ payload (no-pii)
    tx.create(marker, { type: event.type, at: new Date(now).toISOString(), expiresAt: new Date(now + MARKER_TTL_MS) });
}

/** ตาราง Price → แพลน ของแต่ละผลิตภัณฑ์: ราคาปัจจุบัน + previousPriceIds (ราคาเก่าที่ผู้สมัครเดิมยังใช้) */
export type PriceTable<T extends string> = Record<T, { current: string | null; previous: string[] }>;

/**
 * Price ID → แพลน · ไม่รู้จัก = null — ผู้เรียกต้อง **ไม่ให้แพลน** และ log ลง billingAlerts (ห้ามเดา)
 */
export function resolvePlanFromPrice<T extends string>(table: PriceTable<T>, priceId: string | null | undefined): T | null {
    if (!priceId) return null;
    for (const plan of Object.keys(table) as T[]) {
        const { current, previous } = table[plan];
        if (priceId === current || previous.includes(priceId)) return plan;
    }
    return null;
}

/** id จาก field ที่อาจเป็น string หรือ object ที่ expand แล้ว */
export function idOf(ref: string | { id: string } | null | undefined): string | null {
    if (!ref) return null;
    return typeof ref === 'string' ? ref : ref.id || null;
}
