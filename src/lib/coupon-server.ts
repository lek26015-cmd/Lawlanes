import 'server-only';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

/**
 * ตัดสิทธิ์คูปอง 1 ครั้ง "ภายใน transaction เดียวกับการเขียนรายการชำระเงิน"
 *
 * ทำไมไม่เป็น server action แล้ว:
 *   เดิม redeemCoupon() ถูก export จากไฟล์ 'use server' → Next.js เปิดเป็น endpoint
 *   ให้ใครก็ได้ที่ล็อกอินยิงตรงๆ ด้วย couponId ใดก็ได้ วนยิงจน usedCount ชน
 *   usageLimit → คูปองของคนอื่นใช้ไม่ได้ทั้งแคมเปญ ไฟล์นี้เป็น server-only
 *   import ได้จากโค้ดฝั่ง server เท่านั้น ไม่มี endpoint ให้เรียก
 *
 * ทำไมต้องอยู่ใน transaction เดียวกับการสร้างเอกสาร:
 *   เดิมเช็ค usageLimit ตอนคิดราคา แล้วค่อยตัดสิทธิ์ทีหลัง และถ้าตัดไม่สำเร็จแค่
 *   log ทิ้ง → ยิงพร้อมกันหลายคำขอ ทุกคำขอผ่านด่านเช็ค ได้ส่วนลดเกิน usageLimit
 *   ถ้าตัดสิทธิ์กับเขียนรายการอยู่ใน transaction เดียวกัน คูปองเต็มเมื่อไหร่
 *   ทั้งก้อนจะล้ม ไม่มีรายการไหนได้ส่วนลดโดยไม่ถูกนับ
 *
 * ⚠️ Firestore transaction ต้องอ่านให้ครบก่อนเขียน — เรียกฟังก์ชันนี้หลัง tx.get()
 *    อื่นๆ ทั้งหมด และก่อน tx.set()/tx.update() ของผู้เรียก
 */
export class CouponRedeemError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CouponRedeemError';
    }
}

export async function redeemCouponInTx(tx: Transaction, db: Firestore, couponId: string): Promise<void> {
    const ref = db.collection('coupons').doc(couponId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new CouponRedeemError('ไม่พบคูปอง');

    const c = snap.data()!;
    // เช็คซ้ำตอนตัดสิทธิ์ — ระหว่างคิดราคากับกดยืนยัน แอดมินอาจปิดคูปองไปแล้ว
    if (c.isActive === false) throw new CouponRedeemError('คูปองนี้ถูกปิดใช้งานแล้ว');
    const expiry = c.expiryDate?.toDate?.();
    if (expiry && expiry < new Date()) throw new CouponRedeemError('คูปองนี้หมดอายุแล้ว');

    const used = Number(c.usedCount ?? 0);
    if (c.usageLimit && used >= c.usageLimit) {
        throw new CouponRedeemError('คูปองนี้ถูกใช้จนครบจำนวนสิทธิ์แล้ว');
    }
    tx.update(ref, { usedCount: used + 1 });
}
