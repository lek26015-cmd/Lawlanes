/**
 * คิดราคางานล่ามจากเรทการ์ด / ใบเสนอราคา — pure function ไม่แตะ Firestore
 *
 * ⚠️ ยอดที่ใช้ตัดสินเรื่องเงินต้องคิดฝั่ง server เสมอ (interpreter-booking-actions.ts)
 *    หน้าเว็บเรียกได้เพื่อแสดงราคาคร่าวๆ เท่านั้น
 *
 * GP ปัดลงเป็นสตางค์ แล้ว net = gross − gp เสมอ → gp + net = gross ไม่มีเศษหาย
 */

import {
    BOOKING_LIMITS,
    GP_LIMITS,
    INTERPRETER_SERVICES,
    OFFER_LIMITS,
    RATE_LIMITS,
    RATE_UNITS,
    bahtToSatang,
    type InterpreterQuote,
    type RateItem,
} from './interpreter-types';

export type QuoteResult = { ok: true; quote: InterpreterQuote } | { ok: false; error: string };

function inRange(v: unknown, r: { min: number; max: number }): v is number {
    return typeof v === 'number' && Number.isFinite(v) && v >= r.min && v <= r.max;
}

function withGp(base: Omit<InterpreterQuote, 'gpPercent' | 'gpAmount' | 'netToInterpreter'>, gpPercent: number): InterpreterQuote {
    const gpAmount = Math.floor((base.grossAmount * gpPercent) / 100);
    return { ...base, gpPercent, gpAmount, netToInterpreter: base.grossAmount - gpAmount };
}

/**
 * ตรวจและทำความสะอาดรายการเรทการ์ด 1 รายการ — คืน error หรือรายการที่ปลอดภัย
 * ใช้ทั้งตอนล่ามบันทึก (profile actions) และตอนอ่านกลับมาคิดราคา
 */
export function sanitizeRateItem(raw: any): { ok: true; item: RateItem } | { ok: false; error: string } {
    const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, RATE_LIMITS.name) : '';
    if (!name) return { ok: false, error: 'กรุณาตั้งชื่อรายการในเรทการ์ด' };
    if (!(RATE_UNITS as readonly string[]).includes(raw?.unit)) return { ok: false, error: `หน่วยของ "${name}" ไม่ถูกต้อง` };
    const price = Number(raw?.price);
    if (!inRange(price, RATE_LIMITS.price)) {
        return { ok: false, error: `ราคา "${name}" ต้องอยู่ระหว่าง ${RATE_LIMITS.price.min.toLocaleString()}-${RATE_LIMITS.price.max.toLocaleString()} บาท` };
    }
    const minQty = raw?.unit === 'hour' || raw?.unit === 'page' ? Math.floor(Number(raw?.minQty) || 1) : 1;
    if (!inRange(minQty, RATE_LIMITS.minQty)) return { ok: false, error: `จำนวนขั้นต่ำของ "${name}" ไม่ถูกต้อง` };
    const sessionHours = raw?.unit === 'session' ? Math.floor(Number(raw?.sessionHours) || 0) : 0;
    if (raw?.unit === 'session' && !inRange(sessionHours, RATE_LIMITS.sessionHours)) {
        return { ok: false, error: `ระยะเวลาต่อครั้งของ "${name}" ต้องเป็น ${RATE_LIMITS.sessionHours.min}-${RATE_LIMITS.sessionHours.max} ชั่วโมง` };
    }
    const id = typeof raw?.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(raw.id) ? raw.id : '';
    return {
        ok: true,
        item: {
            id,
            name,
            description: typeof raw?.description === 'string' ? raw.description.trim().slice(0, RATE_LIMITS.description) : '',
            unit: raw.unit,
            price: Math.round(price * 100) / 100,
            minQty,
            sessionHours,
            services: Array.isArray(raw?.services)
                ? [...new Set(raw.services)].filter((s: any) => (INTERPRETER_SERVICES as readonly string[]).includes(s)) as RateItem['services']
                : [],
        },
    };
}

/** ราคาเริ่มต้นสำหรับแสดงบนการ์ด — รายการที่ถูกที่สุดต่อหน่วย */
export function cheapestRate(items: RateItem[]): RateItem | null {
    return items.length ? [...items].sort((a, b) => a.price - b.price)[0] : null;
}

/**
 * ยอดจากรายการในเรทการ์ด
 * quantity: ชั่วโมง (hour) / วัน (day) / หน้า (page) · session และ case = 1 เสมอ
 */
export function computeRateQuote(item: RateItem, quantity: number | undefined, gpPercent: number): QuoteResult {
    if (!inRange(gpPercent, GP_LIMITS)) return { ok: false, error: 'อัตรา GP ไม่ถูกต้อง' };
    const clean = sanitizeRateItem(item);
    if (!clean.ok) return { ok: false, error: 'ล่ามตั้งเรทการ์ดไม่ถูกต้อง' };

    let units = 1;
    if (item.unit === 'hour') {
        units = Number(quantity);
        if (!Number.isInteger(units) || units < 1 || units > BOOKING_LIMITS.maxHours) {
            return { ok: false, error: `จำนวนชั่วโมงต้องเป็นจำนวนเต็ม 1-${BOOKING_LIMITS.maxHours}` };
        }
        if (units < item.minQty) return { ok: false, error: `รายการนี้ขั้นต่ำ ${item.minQty} ชั่วโมง` };
    } else if (item.unit === 'day') {
        units = Number(quantity);
        if (!Number.isInteger(units) || units < 1 || units > RATE_LIMITS.maxDays) {
            return { ok: false, error: `จำนวนวันต้องเป็น 1-${RATE_LIMITS.maxDays}` };
        }
    } else if (item.unit === 'page') {
        units = Number(quantity);
        if (!Number.isInteger(units) || units < 1 || units > BOOKING_LIMITS.maxPages) {
            return { ok: false, error: `จำนวนหน้าต้องเป็นจำนวนเต็ม 1-${BOOKING_LIMITS.maxPages}` };
        }
        if (units < item.minQty) return { ok: false, error: `รายการนี้ขั้นต่ำ ${item.minQty} หน้า` };
    }

    const unitRate = bahtToSatang(item.price);
    return {
        ok: true,
        quote: withGp({ itemName: item.name, unitType: item.unit, units, unitRate, grossAmount: unitRate * units }, gpPercent),
    };
}

/** ยอดจากใบเสนอราคาที่ล่ามส่งในแชท (ราคาเหมาก้อนเดียว) */
export function computeOfferQuote(title: string, amountBaht: number, gpPercent: number): QuoteResult {
    if (!inRange(gpPercent, GP_LIMITS)) return { ok: false, error: 'อัตรา GP ไม่ถูกต้อง' };
    if (!inRange(amountBaht, OFFER_LIMITS.amount)) {
        return { ok: false, error: `ยอดใบเสนอราคาต้องอยู่ระหว่าง ${OFFER_LIMITS.amount.min.toLocaleString()}-${OFFER_LIMITS.amount.max.toLocaleString()} บาท` };
    }
    const gross = bahtToSatang(amountBaht);
    return { ok: true, quote: withGp({ itemName: title, unitType: 'offer', units: 1, unitRate: gross, grossAmount: gross }, gpPercent) };
}
