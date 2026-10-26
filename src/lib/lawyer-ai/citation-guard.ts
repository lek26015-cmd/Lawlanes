/**
 * ตรวจคำตอบ AI หลังตอบเสร็จ: เลขมาตรา เลขฎีกา และตัวเลขที่เป็นข้อกฎหมาย (วัน/เดือน/ปี, เงิน, ร้อยละ, เท่า)
 * ต้องมีอยู่จริงในข้อความที่ส่งให้โมเดล (ตัวบทจาก RAG + ข้อความผู้ใช้/เอกสารแนบ/ข้อมูลคดี)
 * ตัวไหนไม่มี → แทนเฉพาะตัวเลขนั้นด้วย UNVERIFIED_LABEL (คงคำรอบข้างไว้ ข้อความไม่กระโดดทั้งย่อหน้า)
 *
 * prompt สั่งห้ามแต่งเลขอยู่แล้ว แต่โมเดลยังหลุดได้ — นี่คือด่านที่ไม่พึ่งโมเดล
 * ไม่มี import ฝั่ง server เพื่อให้รัน unit test ได้ตรง ๆ (scripts/tests/citation-guard.test.ts) และ client ใช้ UNVERIFIED_PATTERN ได้
 */

/** ลูกค้าทั่วไป — บอกให้ไปถามทนาย */
export const UNVERIFIED_LABEL = '[ควรตรวจกับทนาย]';
/** ทนาย — ผู้ใช้คือทนายเอง ให้ไปเปิดตัวบท */
export const UNVERIFIED_LABEL_LAWYER = '[ตรวจตัวบท]';
/** หาป้ายในคำตอบ (หน้าแชตทำเป็นป้ายสีเหลือง) */
export const UNVERIFIED_PATTERN = /\[(ควรตรวจกับทนาย|ตรวจตัวบท)\]/g;

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const DIGIT = '[0-9๐-๙]';
// 60,000 · ๖๐,๐๐๐ · 7.5
const NUM = `${DIGIT}+(?:,${DIGIT}{3})*(?:\\.${DIGIT}+)?`;
const WORD_DIGITS: Record<string, number> = { หนึ่ง: 1, เอ็ด: 1, สอง: 2, ยี่: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9 };
const WORD_UNITS: Record<string, number> = { สิบ: 10, ร้อย: 100, พัน: 1_000, หมื่น: 10_000, แสน: 100_000 };
const WORD = '(?:หนึ่ง|เอ็ด|สอง|ยี่|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ร้อย|พัน|หมื่น|แสน|ล้าน)+';
// "6 หมื่น" · "1.5 ล้าน" · "หกหมื่น" · "60,000"
const AMOUNT = `(?:${NUM}(?:\\s*(?:พัน|หมื่น|แสน|ล้าน))?|${WORD})`;
const UNIT = '(?:วัน|เดือน|ปี|สัปดาห์|ชั่วโมง|บาท|เท่า|เปอร์เซ็นต์|%|(?:years?|months?|weeks?|days?|hours?|baht|THB|times|percent)\\b)';
const RANGE_SEP = '\\s*(?:-|–|ถึง)\\s*';

// "60,000 บาท" · "1-3 ปี" · "สามปี" · "6 หมื่นบาท" · "7.5%" — ไม่มี lookbehind เลยใช้กลุ่มนำหน้ากันไปจับกลางคำ/กลางเลข
const QUANTITY = new RegExp(`(^|[^0-9๐-๙,.])(${AMOUNT})(?:(${RANGE_SEP})(${AMOUNT}))?(\\s*${UNIT})`, 'g');
// "ร้อยละ 15" · "ร้อยละสิบห้า"
const PERCENT = new RegExp(`(ร้อยละ\\s*)(${NUM}|${WORD})`, 'g');
// "มาตรา 420" · "มาตรา 309, 310 และ 311" · "มาตรา 1336/1" · "Section 420"
// ไม่นับ "ม." เพราะชนกับ "ม.6" (ชั้นมัธยม)
const SECTION_NO = `${DIGIT}+(?:\\/${DIGIT}+)?`;
const SECTION_REF = new RegExp(`(มาตรา|[Ss]ection|[Ss]ec\\.)(\\s*)(${SECTION_NO}(?:\\s*(?:,|และ|หรือ|ถึง|-|–)\\s*${SECTION_NO})*)`, 'g');
// "ฎีกาที่ 1234/2560" · "คำพิพากษาศาลฎีกาที่ ๑๒๓๔/๒๕๖๐" · "ฎ.1234/2560"
const JUDGMENT_REF = new RegExp(`((?:ฎีกา|ฎ\\.)\\s*(?:ที่\\s*)?)(${DIGIT}+\\/${DIGIT}{4})`, 'g');
// ร่างเอกสารเป็นตัวเลือกของผู้ร่าง (เช่น "ชำระภายใน 7 วัน") ไม่ใช่ข้อกฎหมาย — ข้ามการตรวจตัวเลข แต่ยังตรวจเลขมาตรา
const DOCUMENT_BLOCK = /---เอกสาร---[\s\S]*?(?:---จบเอกสาร---|$)/g;

export function toArabic(s: string): string {
    return s.replace(/[๐-๙]/g, d => String(THAI_DIGITS.indexOf(d)));
}

/** "หกหมื่น" → 60000 · "สิบห้า" → 15 · "ยี่สิบเอ็ด" → 21 · "หนึ่งล้านห้าแสน" → 1500000 */
export function parseThaiNumberWords(text: string): number | null {
    const tokens = text.match(/หนึ่ง|เอ็ด|สอง|ยี่|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ร้อย|พัน|หมื่น|แสน|ล้าน/g);
    if (!tokens || tokens.join('') !== text) return null;
    let millions = 0;
    let current = 0;
    let digit: number | null = null;
    for (const t of tokens) {
        if (t in WORD_DIGITS) {
            digit = WORD_DIGITS[t];
        } else if (t in WORD_UNITS) {
            current += (digit ?? 1) * WORD_UNITS[t];
            digit = null;
        } else {
            // ล้าน
            millions = (millions * 1_000_000) + (current + (digit ?? 0) || 1);
            current = 0;
            digit = null;
        }
    }
    return millions * 1_000_000 + current + (digit ?? 0);
}

const MULTIPLIER: Record<string, number> = { พัน: 1_000, หมื่น: 10_000, แสน: 100_000, ล้าน: 1_000_000 };

/** ตัวเลขในรูปแบบไหนก็ได้ (ตัวเลขไทย/อารบิก มีจุลภาค มีหน่วยคูณ หรือเป็นคำ) → ค่าตัวเลข */
export function parseAmount(raw: string): number | null {
    const s = raw.replace(/\s+/g, '');
    const m = toArabic(s).match(/^([0-9,]+(?:\.[0-9]+)?)(พัน|หมื่น|แสน|ล้าน)?$/);
    if (m) {
        const n = Number(m[1].replace(/,/g, ''));
        return Number.isFinite(n) ? n * (m[2] ? MULTIPLIER[m[2]] : 1) : null;
    }
    return parseThaiNumberWords(s);
}

const normalizeSection = (s: string) => toArabic(s.replace(/\s+/g, ''));

const UNIT_KIND: [RegExp, string][] = [
    [/^(วัน|days?)$/i, 'day'],
    [/^(สัปดาห์|weeks?)$/i, 'week'],
    [/^(เดือน|months?)$/i, 'month'],
    [/^(ปี|years?)$/i, 'year'],
    [/^(ชั่วโมง|hours?)$/i, 'hour'],
    [/^(บาท|baht|THB)$/i, 'baht'],
    [/^(เท่า|times)$/i, 'times'],
    [/^(เปอร์เซ็นต์|%|percent)$/i, 'percent'],
];
function unitKind(unit: string): string {
    const u = unit.trim();
    return UNIT_KIND.find(([re]) => re.test(u))?.[1] ?? u;
}
const quantityKey = (value: number, kind: string) => `${value}|${kind}`;

export type GroundingIndex = {
    sections: Set<string>;
    judgments: Set<string>;
    /** ตัวเลขพร้อมหน่วยจากตัวบท ("1|year", "20000|baht") — ต้องตรงทั้งค่าและหน่วย */
    quantities: Set<string>;
    /** ตัวเลขใด ๆ จากข้อความผู้ใช้/เอกสารแนบ/ข้อมูลคดี — ผู้ใช้อาจพิมพ์ "ห้าหมื่น" ไม่ใส่หน่วย */
    userNumbers: Set<number>;
};

export type Grounding = {
    /** ตัวบท/ฎีกาที่ RAG ส่งให้โมเดล */
    sources: string[];
    /** ข้อความที่ผู้ใช้ให้มาเอง: คำถาม, เอกสารแนบ, ข้อมูลคดี, ประวัติแชต */
    userTexts?: string[];
};

function collectRefs(text: string, sections: Set<string>, judgments: Set<string>) {
    for (const m of text.matchAll(new RegExp(SECTION_REF.source, 'g'))) {
        for (const n of m[3].match(new RegExp(SECTION_NO, 'g')) || []) sections.add(normalizeSection(n));
    }
    // ตัวบท/ฎีกาเขียนเลขฎีกาได้หลายแบบ เก็บทุก "เลข/ปี4หลัก" ไว้
    for (const m of text.matchAll(new RegExp(`${DIGIT}+\\/${DIGIT}{4}`, 'g'))) judgments.add(normalizeSection(m[0]));
}

export function buildGroundingIndex({ sources, userTexts = [] }: Grounding): GroundingIndex {
    const index: GroundingIndex = { sections: new Set(), judgments: new Set(), quantities: new Set(), userNumbers: new Set() };
    for (const text of sources) {
        if (!text) continue;
        collectRefs(text, index.sections, index.judgments);
        for (const m of text.matchAll(new RegExp(QUANTITY.source, 'g'))) {
            const kind = unitKind(m[5]);
            for (const raw of [m[2], m[4]]) {
                const n = raw === undefined ? null : parseAmount(raw);
                if (n !== null) index.quantities.add(quantityKey(n, kind));
            }
        }
        for (const m of text.matchAll(new RegExp(PERCENT.source, 'g'))) {
            const n = parseAmount(m[2]);
            if (n !== null) index.quantities.add(quantityKey(n, 'percent'));
        }
    }
    for (const text of userTexts) {
        if (!text) continue;
        collectRefs(text, index.sections, index.judgments);
        for (const m of text.matchAll(new RegExp(`(${NUM})(\\s*(?:พัน|หมื่น|แสน|ล้าน))?`, 'g'))) {
            for (const raw of [m[1], m[2] ? m[1] + m[2] : null]) {
                const n = raw === null ? null : parseAmount(raw);
                if (n !== null) index.userNumbers.add(n);
            }
        }
        for (const m of text.matchAll(new RegExp(WORD, 'g'))) {
            const n = parseThaiNumberWords(m[0]);
            if (n !== null) index.userNumbers.add(n);
        }
    }
    return index;
}

export type GuardResult = { text: string; replaced: number };

/** แทนเลขมาตรา/ฎีกา/ตัวเลขที่ไม่มีในแหล่งด้วย label */
export function guardAnswer(answer: string, grounding: Grounding | GroundingIndex, label = UNVERIFIED_LABEL): GuardResult {
    const index = 'quantities' in grounding ? grounding : buildGroundingIndex(grounding);
    let replaced = 0;
    const flag = () => {
        replaced++;
        return label;
    };
    const known = (raw: string, kind: string) => {
        // "หลายล้านบาท" — คำคูณเดี่ยว ๆ ไม่ใช่ตัวเลขที่ระบุ
        if (/^(พัน|หมื่น|แสน|ล้าน)$/.test(raw)) return true;
        const n = parseAmount(raw);
        return n !== null && (index.quantities.has(quantityKey(n, kind)) || index.userNumbers.has(n));
    };

    const checkNumbers = (part: string) => part
        .replace(PERCENT, (_all, lead: string, num: string) => lead + (known(num, 'percent') ? num : flag()))
        .replace(QUANTITY, (_all, lead: string, a: string, sep: string | undefined, b: string | undefined, unit: string) => {
            const kind = unitKind(unit);
            const first = known(a, kind) ? a : flag();
            const second = b === undefined ? '' : sep + (known(b, kind) ? b : flag());
            return lead + first + second + unit;
        });

    // 1) ตัวเลขเชิงปริมาณ — นอกบล็อกร่างเอกสารเท่านั้น
    let out = '';
    let last = 0;
    for (const m of answer.matchAll(DOCUMENT_BLOCK)) {
        out += checkNumbers(answer.slice(last, m.index)) + m[0];
        last = m.index + m[0].length;
    }
    out += checkNumbers(answer.slice(last));

    // 2) เลขฎีกา
    out = out.replace(JUDGMENT_REF, (_all, lead: string, num: string) =>
        lead + (index.judgments.has(normalizeSection(num)) ? num : flag()));

    // 3) เลขมาตรา — ทีละเลขในรายการ "มาตรา 309, 310 และ 999"
    out = out.replace(SECTION_REF, (_all, word: string, space: string, list: string) =>
        word + space + list.replace(new RegExp(SECTION_NO, 'g'), n => (index.sections.has(normalizeSection(n)) ? n : flag())));

    return { text: out, replaced };
}
