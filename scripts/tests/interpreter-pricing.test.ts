/**
 * ทดสอบการคิดราคางานล่าม
 * รัน: npx ts-node-transpile-only -O '{"module":"commonjs","moduleResolution":"node"}' scripts/tests/interpreter-pricing.test.ts
 */
import assert from 'node:assert/strict';
import { computeOfferQuote, computeRateQuote, sanitizeRateItem } from '../../src/lib/interpreter-pricing';
import type { RateItem } from '../../src/lib/interpreter-types';

const item = (x: Partial<RateItem>): RateItem => ({ id: 'a', name: 'x', description: '', unit: 'hour', price: 1500, minQty: 2, sessionHours: 0, services: [], ...x });
function ok(r: ReturnType<typeof computeRateQuote>) {
    if (!r.ok) throw new Error(r.error);
    return r.quote;
}

// ต่อชั่วโมง: 3 ชม. × 1,500 = 4,500 บาท, GP 15% = 675
let q = ok(computeRateQuote(item({}), 3, 15));
assert.equal(q.grossAmount, 450000);
assert.equal(q.gpAmount, 67500);
assert.equal(q.netToInterpreter, 382500);
assert.equal(computeRateQuote(item({}), 1, 15).ok, false); // ต่ำกว่าขั้นต่ำ
assert.equal(computeRateQuote(item({}), 2.5, 15).ok, false); // ไม่ใช่จำนวนเต็ม

// เหมาวัน 3 วัน × 9,000
q = ok(computeRateQuote(item({ unit: 'day', price: 9000, minQty: 1 }), 3, 15));
assert.equal(q.grossAmount, 2700000);
assert.equal(computeRateQuote(item({ unit: 'day', price: 9000 }), 15, 15).ok, false);

// เหมาต่อครั้ง / เหมาคดี = 1 หน่วยเสมอ ไม่ว่าส่ง quantity อะไรมา
q = ok(computeRateQuote(item({ unit: 'session', price: 4000, sessionHours: 4 }), 99, 15));
assert.equal(q.units, 1);
q = ok(computeRateQuote(item({ unit: 'case', price: 60000 }), undefined, 20));
assert.equal(q.grossAmount, 6000000);
assert.equal(q.gpAmount, 1200000);

// ต่อหน้า ราคาทศนิยม: 3 × 450.50 = 1,351.50 → GP 15% = 202.725 ปัดลง 202.72
q = ok(computeRateQuote(item({ unit: 'page', price: 450.5, minQty: 1 }), 3, 15));
assert.equal(q.grossAmount, 135150);
assert.equal(q.gpAmount, 20272);
assert.equal(q.gpAmount + q.netToInterpreter, q.grossAmount);

// ใบเสนอราคา
const o = computeOfferQuote('แปลสัญญา', 12345.67, 15);
assert.ok(o.ok && o.quote.grossAmount === 1234567 && o.quote.gpAmount + o.quote.netToInterpreter === 1234567);
assert.equal(computeOfferQuote('x', 10, 15).ok, false);

// GP นอกช่วง
assert.equal(computeRateQuote(item({}), 3, 60).ok, false);

// ตรวจรายการเรทการ์ด
assert.equal(sanitizeRateItem({ name: '', unit: 'hour', price: 1000 }).ok, false);
assert.equal(sanitizeRateItem({ name: 'a', unit: 'week', price: 1000 }).ok, false);
assert.equal(sanitizeRateItem({ name: 'a', unit: 'hour', price: 5 }).ok, false);
assert.equal(sanitizeRateItem({ name: 'a', unit: 'session', price: 1000, sessionHours: 0 }).ok, false);
const s1 = sanitizeRateItem({ name: ' เหมาวัน ', unit: 'day', price: 8000, minQty: 9, services: ['court', 'hack'] });
assert.ok(s1.ok && s1.item.name === 'เหมาวัน' && s1.item.minQty === 1 && s1.item.services.join() === 'court');

// ทุก GP ที่เป็นไปได้ gp + net = gross
for (let gp = 0; gp <= 50; gp += 0.5) {
    for (const pages of [1, 7, 33, 500]) {
        const r = ok(computeRateQuote(item({ unit: 'page', price: 333.33, minQty: 1 }), pages, gp));
        assert.equal(r.gpAmount + r.netToInterpreter, r.grossAmount);
        assert.ok(Number.isInteger(r.gpAmount) && r.gpAmount >= 0);
    }
}

console.log('interpreter-pricing: all tests passed');

// ---- เวลาไทย (server รัน UTC) ----
import { bangkokDateHourToDate, bangkokParts, slotIdsFor } from '../../src/lib/interpreter-time';

const d = bangkokDateHourToDate('2026-10-05', 9)!;
assert.equal(d.toISOString(), '2026-10-05T02:00:00.000Z');
assert.equal(bangkokParts(d).hour, 9);
assert.equal(bangkokParts(d).dayKey, 'monday');
// 23:00 ไทย = 16:00 UTC วันเดียวกัน, ชั่วโมงถัดไปข้ามวัน
assert.deepEqual(slotIdsFor('abc', bangkokDateHourToDate('2026-10-05', 23)!, 2), ['abc_20261005_23', 'abc_20261006_00']);
assert.equal(bangkokDateHourToDate('2026-02-31', 9), null);
assert.equal(bangkokDateHourToDate('2026-10-05', 24), null);
console.log('interpreter-time: all tests passed');

// ---- ปิดข้อมูลติดต่อในแชทก่อนจ่ายเงิน ----
import { maskContactInfo, MASK_TOKEN } from '../../src/lib/interpreter-chat-utils';

const masked = (s: string) => maskContactInfo(s).masked;
for (const s of [
    'โทร 081-234-5678 ได้เลย', 'call +66 81 234 5678', '0812345678', 'line id: somchai99', 'ไลน์ somchai_99',
    'แอดไลน์ @lawyer.th', 'mail me a.b@gmail.com', 'https://line.me/ti/p/abc', 'wa.me/66812345678', 'wechat: zhang123',
]) assert.ok(masked(s), `should mask: ${s}`);
for (const s of [
    'นัดวันที่ 12 ต.ค. เวลา 09:00', 'ศาลแพ่ง ห้อง 704', 'เอกสาร 15 หน้า ราคา 1,500 บาท', 'คดีหมายเลขดำ พ.1234/2569', 'ขอบคุณครับ',
]) assert.ok(!masked(s), `should not mask: ${s}`);
assert.equal(maskContactInfo('โทร 0812345678 นะ').text, `โทร ${MASK_TOKEN} นะ`);
console.log('interpreter-chat mask: all tests passed');
