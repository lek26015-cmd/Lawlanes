/**
 * เวลาของงานล่ามคิดตามเวลาไทย (Asia/Bangkok = UTC+7 ไม่มี daylight saving)
 *
 * server รันบน UTC — ห้ามใช้ new Date().getHours()/getDay() ตรงๆ กับวันเวลาที่ลูกค้าเลือก
 * ทุกอย่างผ่านฟังก์ชันในไฟล์นี้
 */

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

/** 'YYYY-MM-DD' + ชั่วโมงเริ่ม (เวลาไทย) → Date (UTC instant) หรือ null ถ้ารูปแบบผิด */
export function bangkokDateHourToDate(date: string, hour: number): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const ms = Date.UTC(y, mo - 1, d, hour) - BANGKOK_OFFSET_MS;
    const check = new Date(ms + BANGKOK_OFFSET_MS);
    // กัน 2026-02-31 ที่ Date.UTC ปัดไปเป็นเดือนถัดไป
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
    return new Date(ms);
}

/** ส่วนประกอบของเวลาไทยจาก Date */
export function bangkokParts(when: Date) {
    const b = new Date(when.getTime() + BANGKOK_OFFSET_MS);
    const y = b.getUTCFullYear();
    const mo = b.getUTCMonth() + 1;
    const d = b.getUTCDate();
    return {
        dateKey: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        compact: `${y}${String(mo).padStart(2, '0')}${String(d).padStart(2, '0')}`,
        hour: b.getUTCHours(),
        dayKey: DAY_KEYS[b.getUTCDay()],
    };
}

/** doc id ของ slot รายชั่วโมง: {interpreterId}_{YYYYMMDD}_{HH} */
export function slotIdsFor(interpreterId: string, start: Date, hours: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < hours; i++) {
        const p = bangkokParts(new Date(start.getTime() + i * 60 * 60 * 1000));
        ids.push(`${interpreterId}_${p.compact}_${String(p.hour).padStart(2, '0')}`);
    }
    return ids;
}

/** "09:00" → 9 · คืน null ถ้ารูปแบบผิด */
export function parseHourString(v: unknown): number | null {
    if (typeof v !== 'string') return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
    if (!m) return null;
    const h = Number(m[1]);
    return h >= 0 && h <= 24 ? h : null;
}
