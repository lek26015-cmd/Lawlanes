/**
 * จำนวนเงินเป็นตัวอักษรภาษาไทยสำหรับใบเสร็จ เช่น 3500 → "สามพันห้าร้อยบาทถ้วน",
 * 1250.5 → "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์"
 */
const DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

/** อ่านเลขไม่เกิน 6 หลัก (0–999,999) — "ล้าน" จัดการใน readInteger */
function readUnderMillion(n: number, hasHigherPart: boolean): string {
    const s = String(n);
    let out = '';
    for (let i = 0; i < s.length; i++) {
        const d = Number(s[i]);
        const place = s.length - i - 1;
        if (d === 0) continue;
        if (place === 1 && d === 1) out += 'สิบ';
        else if (place === 1 && d === 2) out += 'ยี่สิบ';
        else if (place === 0 && d === 1 && (s.length > 1 || hasHigherPart)) out += 'เอ็ด';
        else out += DIGITS[d] + PLACES[place];
    }
    return out;
}

function readInteger(n: number): string {
    if (n === 0) return DIGITS[0];
    const parts: string[] = [];
    let rest = n;
    // แบ่งทีละ 6 หลักจากขวา แต่ละช่วงคั่นด้วย "ล้าน"
    while (rest > 0) {
        const chunk = rest % 1_000_000;
        rest = Math.floor(rest / 1_000_000);
        // 1,000,001 = "หนึ่งล้านเอ็ด" — หลักหน่วย 1 อ่าน "เอ็ด" ถ้ามีหลักที่สูงกว่า (รวมช่วงล้าน)
        parts.unshift(chunk === 0 ? '' : readUnderMillion(chunk, rest > 0));
    }
    return parts.join('ล้าน');
}

export function bahtText(amount: number): string {
    if (!Number.isFinite(amount) || amount < 0) throw new Error('จำนวนเงินไม่ถูกต้อง');
    const satangTotal = Math.round(amount * 100);
    const baht = Math.floor(satangTotal / 100);
    const satang = satangTotal % 100;
    const bahtPart = baht > 0 ? `${readInteger(baht)}บาท` : '';
    if (satang === 0) return `${bahtPart || 'ศูนย์บาท'}ถ้วน`;
    return `${bahtPart}${readInteger(satang)}สตางค์`;
}
