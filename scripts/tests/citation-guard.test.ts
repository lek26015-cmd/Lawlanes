/**
 * ทดสอบตัวตรวจเลขมาตรา/ตัวเลขในคำตอบ AI (src/lib/lawyer-ai/citation-guard.ts)
 * รัน: npx ts-node-transpile-only -O '{"module":"commonjs","moduleResolution":"node"}' scripts/tests/citation-guard.test.ts
 */
import assert from 'node:assert/strict';
import { guardAnswer, parseAmount, parseThaiNumberWords, UNVERIFIED_LABEL as L, UNVERIFIED_LABEL_LAWYER, UNVERIFIED_PATTERN } from '../../src/lib/lawyer-ai/citation-guard';

// ตัวบทจริงเขียนด้วยเลขไทยและตัวเลขเป็นคำ
const CRIMINAL = `ประมวลกฎหมายอาญา
มาตรา ๓๒๖ ผู้ใดใส่ความผู้อื่นต่อบุคคลที่สาม โดยประการที่น่าจะทำให้ผู้อื่นนั้นเสียชื่อเสียง ถูกดูหมิ่น หรือถูกเกลียดชัง ผู้นั้นกระทำความผิดฐานหมิ่นประมาท ต้องระวางโทษจำคุกไม่เกินหนึ่งปี หรือปรับไม่เกินสองหมื่นบาท หรือทั้งจำทั้งปรับ
มาตรา ๓๒๘ ถ้าความผิดฐานหมิ่นประมาทได้กระทำโดยการโฆษณา ... ต้องระวางโทษจำคุกไม่เกินสองปี และปรับไม่เกินสองแสนบาท`;
const CIVIL = `มาตรา 193/30 อายุความนั้น ถ้าประมวลกฎหมายนี้หรือกฎหมายอื่นไม่ได้บัญญัติไว้โดยเฉพาะ ให้มีกำหนดสิบปี
มาตรา 224 หนี้เงินนั้น ท่านให้คิดดอกเบี้ยในระหว่างเวลาผิดนัดร้อยละห้าต่อปี`;
const JUDGMENT = 'คำพิพากษาศาลฎีกาที่ ๑๒๓๔/๒๕๖๐ จำเลยโพสต์ข้อความลงเฟซบุ๊ก';

// --- แปลงตัวเลข
assert.equal(parseThaiNumberWords('สองหมื่น'), 20_000);
assert.equal(parseThaiNumberWords('สิบห้า'), 15);
assert.equal(parseThaiNumberWords('ยี่สิบเอ็ด'), 21);
assert.equal(parseThaiNumberWords('หนึ่งล้านห้าแสน'), 1_500_000);
assert.equal(parseThaiNumberWords('สิบล้าน'), 10_000_000);
assert.equal(parseThaiNumberWords('สามี'), null);
assert.equal(parseAmount('๒๐,๐๐๐'), 20_000);
assert.equal(parseAmount('2 แสน'), 200_000);
assert.equal(parseAmount('1.5ล้าน'), 1_500_000);

const sources = { sources: [CRIMINAL, CIVIL, JUDGMENT] };

// --- ตัวเลขที่มีในตัวบท (ต่างรูปแบบกัน) ผ่านทั้งหมด ไม่แก้ข้อความเลย
const good = 'หมิ่นประมาทตามมาตรา 326 มีโทษจำคุกไม่เกิน 1 ปี หรือปรับไม่เกิน 20,000 บาท [1] ถ้าโพสต์ลงโซเชียลเป็นการโฆษณาตามมาตรา 328 โทษจำคุกไม่เกินสองปี ปรับไม่เกิน 2 แสนบาท อายุความทั่วไป 10 ปี (มาตรา 193/30) ดอกเบี้ยผิดนัดร้อยละ 5 ต่อปี ดูฎีกาที่ 1234/2560';
let r = guardAnswer(good, sources);
assert.equal(r.text, good);
assert.equal(r.replaced, 0);

// --- เลขมาตราที่ไม่มีในตัวบท → แทนเฉพาะเลข คงคำว่า "มาตรา" และตัวที่ถูกไว้
r = guardAnswer('ดูมาตรา 326 และ 999 ประกอบ', sources);
assert.equal(r.text, `ดูมาตรา 326 และ ${L} ประกอบ`);
assert.equal(r.replaced, 1);
r = guardAnswer('ตาม Section 420 of the Civil Code', sources);
assert.equal(r.text, `ตาม Section ${L} of the Civil Code`);
// มาตราย่อยต้องตรงทั้ง "193/30" ไม่ใช่แค่ 193
assert.equal(guardAnswer('มาตรา 193/31', sources).text, `มาตรา ${L}`);

// --- โทษ/เงิน/ระยะเวลาที่แต่งขึ้น
r = guardAnswer('จำคุกไม่เกิน 3 ปี ปรับไม่เกิน 60,000 บาท', sources);
assert.equal(r.text, `จำคุกไม่เกิน ${L} ปี ปรับไม่เกิน ${L} บาท`);
assert.equal(r.replaced, 2);
assert.equal(guardAnswer('ต้องฟ้องภายในสามเดือน', sources).text, `ต้องฟ้องภายใน${L}เดือน`);
assert.equal(guardAnswer('ดอกเบี้ยร้อยละ 7.5 ต่อปี', sources).text, `ดอกเบี้ยร้อยละ ${L} ต่อปี`);
assert.equal(guardAnswer('interest at 15% per year', sources).text, `interest at ${L}% per year`);
// ช่วงตัวเลข ตรวจทั้งสองฝั่ง
assert.equal(guardAnswer('จำคุก 1-3 ปี', sources).text, `จำคุก 1-${L} ปี`);
// ฎีกาที่ไม่มีในแหล่ง
assert.equal(guardAnswer('ฎีกาที่ 9999/2565 วางหลักไว้', sources).text, `ฎีกาที่ ${L} วางหลักไว้`);

// --- ตัวเลขที่ผู้ใช้/เอกสารแนบให้มา ผ่านได้ (นับเป็นแหล่งด้วย)
r = guardAnswer('คุณให้ยืมเงิน 50,000 บาท ทวงแล้ว 2 เดือน', { ...sources, userTexts: ['เพื่อนยืมไปห้าหมื่น ผ่านมา 2 เดือนแล้วไม่คืน'] });
assert.equal(r.replaced, 0);

// ตัวเลขเดียวกันแต่คนละหน่วย ไม่ผ่าน ("หนึ่งปี" ในตัวบท ≠ "1 เดือน") และ "บุคคลที่สาม" ไม่ทำให้ "3 ปี" ผ่าน
assert.equal(guardAnswer('จำคุกไม่เกิน 1 เดือน', sources).text, `จำคุกไม่เกิน ${L} เดือน`);
// เลขมาตราที่ผู้ใช้พิมพ์มาเอง ผ่าน
assert.equal(guardAnswer('มาตรา 341 ที่คุณถามมา', { ...sources, userTexts: ['มาตรา 341 คืออะไร'] }).replaced, 0);

// --- ตัวเลขที่ไม่ใช่ข้อกฎหมาย ไม่ถูกแตะ
for (const s of ['โทรแจ้งตำรวจ 191', 'ปี พ.ศ. 2567', 'ข้อ 3 ของสัญญา', 'จบ ม.6 แล้ว', 'เสียหายหลายล้านบาท', 'ภายในเดือนนี้']) {
    assert.equal(guardAnswer(s, sources).text, s, s);
}

// --- ร่างเอกสาร: ตัวเลขในตัวเอกสารเป็นการเลือกของผู้ร่าง ไม่ตรวจ แต่เลขมาตรายังตรวจ
const draft = 'ร่างให้ค่ะ\n---เอกสาร---\nขอให้ชำระภายใน 7 วัน ตามมาตรา 999\n---จบเอกสาร---\nหมายเหตุ: ดอกเบี้ยร้อยละ 15';
r = guardAnswer(draft, sources);
assert.equal(r.text, `ร่างให้ค่ะ\n---เอกสาร---\nขอให้ชำระภายใน 7 วัน ตามมาตรา ${L}\n---จบเอกสาร---\nหมายเหตุ: ดอกเบี้ยร้อยละ ${L}`);
assert.equal(r.replaced, 2);

// --- ไม่มีแหล่งเลย: ทุกเลขมาตรา/โทษถูกแทน
r = guardAnswer('ผิดมาตรา 341 ฉ้อโกง จำคุกไม่เกิน 3 ปี', { sources: [] });
assert.equal(r.text, `ผิดมาตรา ${L} ฉ้อโกง จำคุกไม่เกิน ${L} ปี`);

// --- ป้ายของทนาย และหน้าแชตหาป้ายทั้งสองแบบเจอ
r = guardAnswer('ผิดมาตรา 341', { sources: [] }, UNVERIFIED_LABEL_LAWYER);
assert.equal(r.text, `ผิดมาตรา ${UNVERIFIED_LABEL_LAWYER}`);
assert.equal(`a ${L} b ${UNVERIFIED_LABEL_LAWYER}`.replace(UNVERIFIED_PATTERN, '<$1>'), 'a <ควรตรวจกับทนาย> b <ตรวจตัวบท>');

console.log('citation-guard: ok');
