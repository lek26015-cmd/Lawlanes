/**
 * กติกาข้อมูลติดต่อของบริการล่าม — pure function ใช้ได้ทั้ง server และเทสต์
 *
 * ก่อนลูกค้าจ่ายเงิน ห้ามทั้งสองฝ่ายเห็นเบอร์ / LINE ID / อีเมล ของกันและกัน และต้องคุยผ่าน
 * แชทของแพลตฟอร์มเท่านั้น (กันตกลงงานกันเองนอกระบบ) → ข้อความในแชทถูกปิดข้อมูลติดต่อ
 * อัตโนมัติจนกว่าจะมีงานที่ยืนยันการชำระเงินแล้วระหว่างคู่นี้
 *
 * ⚠️ regex จับได้เฉพาะรูปแบบที่พบบ่อย (เลข 9 หลักขึ้นไป, อีเมล, LINE/@handle, ลิงก์ติดต่อ)
 *    คนที่ตั้งใจเลี่ยง (สะกดตัวเลขเป็นคำ) ยังเลี่ยงได้ — แอดมินตรวจต้นฉบับได้จากหลังบ้าน
 */

import type { InterpreterBookingStatus } from './interpreter-types';

/** สถานะที่ถือว่าลูกค้าจ่ายเงินแล้ว → เปิดเผยข้อมูลติดต่อได้ */
export const CONTACT_UNLOCK_STATUSES: InterpreterBookingStatus[] = ['paid', 'accepted', 'completed'];

export const MASK_TOKEN = '[•••]';

/** ห้องแชท 1 ห้องต่อ (ลูกค้า, ล่าม) — id คงที่ เปิดซ้ำได้ห้องเดิม */
export function conversationIdFor(customerId: string, interpreterId: string): string {
    return `${customerId}_${interpreterId}`;
}

const PATTERNS: RegExp[] = [
    // ลิงก์ช่องทางติดต่อ
    /(?:https?:\/\/)?(?:www\.)?(?:line\.me|lin\.ee|wa\.me|t\.me|m\.me|facebook\.com|fb\.com|fb\.me|instagram\.com|wechat\.com|u\.wechat\.com)\/?\S*/gi,
    // อีเมล
    /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
    // "line id: xxx" / "ไลน์ xxx" / "wechat: xxx" / "whatsapp xxx"
    /(?:line\s*(?:id)?|ไลน์|ไลน|ไอดีไลน์|ไอดี|wechat|we\s*chat|วีแชท|whatsapp|telegram|เทเลแกรม)\s*[:：=]?\s*@?[\w.\-]{3,}/gi,
    // @handle
    /(?<![\w])@[\w.\-]{3,}/g,
];

/** เลขโทรศัพท์: กลุ่มตัวเลข (อาจมีช่องว่าง/ขีด/วงเล็บ/จุด) ที่มีตัวเลขรวม >= 9 หลัก */
const PHONE_LIKE = /\+?\d[\d\s\-().]{6,}\d/g;

export function maskContactInfo(text: string): { text: string; masked: boolean } {
    let out = text;
    for (const re of PATTERNS) out = out.replace(re, MASK_TOKEN);
    out = out.replace(PHONE_LIKE, m => (m.replace(/\D/g, '').length >= 9 ? MASK_TOKEN : m));
    return { text: out, masked: out !== text };
}
