import 'server-only';

import { getKrisdikaChunks, retrieveExpanded, resolveLawTitles, type RagDocument } from '@/lib/rag';
import { sourceLabel, sourceType } from '@/lib/lawyer-ai/source-labels';
import type { AiCitation, AiMode } from '@/lib/lawyer-ai/types';

/**
 * ค้นตัวบท/ฎีกาจากฐานข้อมูล RAG แล้วจัดเป็นรายการอ้างอิงที่มีเลขกำกับ ให้ AI อ้าง [1] [2] ได้
 * chunk ที่มาจากกฎหมายฉบับเดียวกันรวมเป็นข้อเดียว (ไม่งั้น AI อ้างซ้ำฉบับเดิมหลายเลข)
 */
export async function findLawSources(query: string, mode: AiMode, limit = 8): Promise<AiCitation[]> {
    const q = query.trim().slice(0, 1500);
    if (!q) return [];
    const raw = await retrieveExpanded(q, 10);
    // โหมดฎีกา: ดันคำพิพากษาขึ้นก่อน (ปกติ retrieveExpanded เรียงตัวบทก่อน)
    const ordered = mode === 'judgment'
        ? [...raw.filter(r => sourceType(r.source) === 'judgment'), ...raw.filter(r => sourceType(r.source) !== 'judgment')]
        : raw;
    const top = ordered.slice(0, 14);
    if (top.length === 0) return [];

    const titles = await resolveLawTitles(top.map(r => r.source));
    const groups = new Map<string, { citation: Omit<AiCitation, 'content'>; docs: RagDocument[] }>();
    for (const r of top) {
        const title = titles.get(r.source) || sourceLabel(r.source);
        // หาชื่อไม่ได้ ("เอกสารกฎหมาย") → แยกตาม source ไม่งั้นเอกสารคนละฉบับถูกรวมกัน
        const key = titles.has(r.source) ? `${title}|${r.year ?? ''}` : r.source;
        const g = groups.get(key);
        if (g) g.docs.push(r);
        else if (groups.size < limit) {
            // ไม่ใส่ year เมื่อไม่มีค่า — Firestore ไม่รับ undefined (บันทึกข้อความลงเธรดจะล้ม)
            groups.set(key, { citation: { n: groups.size + 1, title, type: sourceType(r.source), ...(r.year ? { year: r.year } : {}) }, docs: [r] });
        }
    }
    return Promise.all([...groups.values()].map(async g => ({ ...g.citation, content: await buildContent(g.docs) })));
}

/**
 * chunk ของไฟล์กฤษฎีกายาว 1,000 ตัวอักษร ซ้อนกัน 200 — มาตราที่อยู่ท้าย/ต้น chunk จึงถูกตัดกลางคำ
 * ดึง chunk ก่อน/หลังมาต่อกัน แล้วเก็บเฉพาะมาตราที่ chunk ที่ค้นเจอแตะถึง (ได้มาตราเต็ม ไม่ยาวเกินจำเป็น)
 * แหล่งอื่น (ThaiLawCSV เป็นรายมาตราอยู่แล้ว, ฎีกา, ราชกิจจาฯ) ใช้ mergeChunks ตามเดิม
 */
export async function buildContent(docs: RagDocument[]): Promise<string> {
    const bySource = new Map<string, RagDocument[]>();
    const others: string[] = [];
    const csv: string[] = [];
    for (const d of docs) {
        if (d.source.startsWith('พ.ร.บ. กฤษฎีกา/') && typeof d.chunkIndex === 'number') {
            bySource.set(d.source, [...(bySource.get(d.source) || []), d]);
        } else if (d.source.startsWith('ThaiLawCSV/')) {
            csv.push(d.content); // หนึ่งแถว = หนึ่งมาตราเต็ม
        } else {
            others.push(d.content);
        }
    }
    const sections = new Map<string, Section>();
    await Promise.all([...bySource.entries()].map(async ([source, list]) => {
        const total = list[0].totalChunks ?? Infinity;
        const have = new Map(list.map(d => [d.chunkIndex as number, cleanChunk(d.content)]));
        const need = [...have.keys()].flatMap(i => [i - 1, i + 1]).filter(i => i >= 0 && i < total && !have.has(i));
        const fetched = await getKrisdikaChunks(source, need);
        fetched.forEach((text, i) => have.set(i, cleanChunk(text)));
        const matched = new Set(list.map(d => d.chunkIndex as number));
        for (const run of runsOf([...have.keys()].sort((a, b) => a - b))) {
            const { text, spans } = stitch(run.map(i => ({ i, text: have.get(i) || '' })));
            const ranges = spans.filter(sp => matched.has(sp.i)).map(sp => [sp.start, sp.end] as [number, number]);
            const endIsComplete = run[run.length - 1] === total - 1;
            for (const sec of splitSections(text, ranges, endIsComplete)) addSection(sections, sec);
        }
    }));
    for (const raw of csv) splitSections(cleanChunk(raw), null, true).forEach(sec => addSection(sections, sec));
    const rest = others.length > 0 ? mergeChunks(others) : '';
    return [render(sections), rest].filter(Boolean).join('\n').slice(0, 8000);
}

type Section = { num: string; order: number; text: string; cut: boolean };

function runsOf(sorted: number[]): number[][] {
    const runs: number[][] = [];
    for (const i of sorted) {
        const last = runs[runs.length - 1];
        if (last && i === last[last.length - 1] + 1) last.push(i);
        else runs.push([i]);
    }
    return runs;
}

/** ต่อ chunk ที่ติดกัน ตัดส่วนที่ซ้อนกัน (หาต้น chunk ถัดไปในท้าย chunk ก่อนหน้า) */
function stitch(chunks: { i: number; text: string }[]) {
    let text = '';
    const spans: { i: number; start: number; end: number }[] = [];
    for (const c of chunks) {
        let start = text.length;
        if (text) {
            const probe = c.text.slice(0, 60);
            const at = probe.length >= 20 ? text.lastIndexOf(probe, text.length) : -1;
            if (at >= 0 && at >= text.length - 400) {
                text = text.slice(0, at) + c.text;
                start = at;
            } else {
                text += '\n' + c.text;
                start += 1;
            }
        } else {
            text = c.text;
        }
        spans.push({ i: c.i, start, end: start + c.text.length });
    }
    return { text, spans };
}

/** แยกเป็นรายมาตรา · ranges = เก็บเฉพาะมาตราที่ทับช่วงนี้ (null = ทุกมาตรา) · เศษก่อนหัวมาตราแรกทิ้ง */
function splitSections(text: string, ranges: [number, number][] | null, endIsComplete: boolean): Section[] {
    // หัวมาตราจริงในตัวบทเรียงเลขขึ้นเสมอ — "มาตรา ๑๐" ที่โผล่กลางมาตรา ๑๒ คือการอ้างถึง ไม่ใช่หัวใหม่
    // (เดิมตัดมาตรา ๑๒ ขาด แล้วเอาเนื้อของ ๑๒ ไปแปะเป็นมาตรา ๑๐)
    let last = -1;
    const heads = [...text.matchAll(SECTION_HEAD)].filter(m => {
        if (REFERENCE_BEFORE.test(text.slice(0, m.index))) return false;
        const order = sectionOrder(m[1]);
        if (order <= last) return false;
        last = order;
        return true;
    });
    return heads.flatMap((m, i) => {
        const start = m.index;
        const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
        if (ranges && !ranges.some(([a, b]) => start < b && end > a)) return [];
        const body = text.slice(start, end).trim();
        // มาตราสุดท้ายที่ไม่ใช่ท้ายไฟล์ อาจยังขาดอยู่ — ใส่ … ถ้าจบไม่เป็นประโยค
        const cut = i === heads.length - 1 && !endIsComplete && !ENDS_CLEAN.test(body);
        return [{ num: m[1] + (m[2] ? ` ${m[2]}` : ''), order: sectionOrder(m[1]), text: body, cut }];
    });
}

function addSection(map: Map<string, Section>, sec: Section) {
    const prev = map.get(sec.num);
    // ฉบับที่ไม่ถูกตัดชนะ แล้วค่อยดูความยาว
    if (!prev || (prev.cut && !sec.cut) || (prev.cut === sec.cut && sec.text.length > prev.text.length)) map.set(sec.num, sec);
}

function render(map: Map<string, Section>) {
    return [...map.values()].sort((a, b) => a.order - b.order).map(s => (s.cut ? `${s.text}…` : s.text)).join('\n');
}

const THAI_DIGIT = '๐๑๒๓๔๕๖๗๘๙';
// หัวมาตรา — ไม่นับ "ตามมาตรา ๒๖" / "โดยมาตรา ๔ แห่ง…" ซึ่งเป็นการอ้างถึง
const SECTION_HEAD = /มาตรา\s*([๐-๙\d]+(?:\/[๐-๙\d]+)?)(?:\s*(ทวิ|ตรี|จัตวา|เบญจ))?/g;
const REFERENCE_BEFORE = /(ตาม|ใน|แห่ง|และ|หรือ|ถึง|ดัง|โดย|บัญญัติ|วรรค|,)\s*$/;
const ORPHAN_MARKS = /^[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]+/;

function sectionOrder(num: string): number {
    const arabic = num.replace(/[๐-๙]/g, d => String(THAI_DIGIT.indexOf(d)));
    const [main, sub] = arabic.split('/');
    return Number(main) * 1000 + (Number(sub) || 0);
}

/**
 * chunk ในฐานข้อมูลถูกตัดตามจำนวนตัวอักษรและซ้อนทับกัน — รวมหลาย chunk ของกฎหมายฉบับเดียวกันให้อ่านรู้เรื่อง
 * แยกเป็นรายมาตราตามหัว "มาตรา n" → ทิ้งเศษต้น chunk → มาตราซ้ำเก็บฉบับที่ยาวที่สุด → เรียงตามเลขมาตรา
 * ไม่มีหัวมาตราเลย (ฎีกา / ราชกิจจาฯ) ใช้ tidyExcerpt ทีละ chunk เหมือนเดิม
 */
export function mergeChunks(chunks: string[]): string {
    const sections = new Map<string, Section>();
    const loose: string[] = [];
    for (const raw of chunks) {
        const secs = splitSections(cleanChunk(raw), null, false);
        if (secs.length === 0) loose.push(tidyExcerpt(raw));
        else secs.forEach(sec => addSection(sections, sec));
    }
    return [render(sections), ...loose].filter(Boolean).join('\n').slice(0, 6000);
}

const ENDS_CLEAN = /([.)\]”"]|นั้น|แล้ว|ได้|บาท|ด้วย|นี้|ก็ได้|ปรับ|ไม่ได้|เป็นต้น)$/;

function cleanChunk(text: string): string {
    let t = text
        // ชุดราชกิจจาฯ บางไฟล์เก็บเป็น JSON ดิบ {"natural_text": "..."}
        .replace(/\{\s*"natural_text"\s*:\s*"/g, '')
        .replace(/"\s*\}\s*$/g, '')
        .replace(/<\/(td|th)>/gi, ' ')
        .replace(/<\/tr>|<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/^--\s*\d+\s*of\s*\d+\s*--$/gm, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n')
        .trim();
    const csvBody = t.match(/^กฎหมาย:[^\n]*\n\s*มาตรา:[^\n]*\n\s*เนื้อหา:\s*([\s\S]*)$/);
    if (csvBody) t = csvBody[1].replace(/^null\s*/, '').trim();
    return t.replace(ORPHAN_MARKS, '');
}

// chunk ในฐานข้อมูลถูกตัดตามจำนวนตัวอักษร จึงมักเริ่ม/จบกลางคำ ("อร์ซึ่งข้อมูล...")
// และชุด ThaiLawCSV มีหัว "กฎหมาย: Criminal / มาตรา: 327 / เนื้อหา:" ติดมาด้วย
export function tidyExcerpt(text: string): string {
    let t = text
        // ชุดราชกิจจาฯ บางไฟล์ OCR ออกมาเป็นตาราง HTML และมีเลขหน้า/หัวกระดาษของ PDF ปนมา
        .replace(/<\/(td|th)>/gi, ' ')
        .replace(/<\/tr>|<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/^--\s*\d+\s*of\s*\d+\s*--$/gm, '')
        .replace(/^หน(?:้)?า\s+[๐-๙\d]+\s+เล(?:่)?ม\s+[๐-๙\d]+.*ราชกิจจานุเบกษา.*$/gm, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n')
        .trim();
    const csvBody = t.match(/^กฎหมาย:[^\n]*\n\s*มาตรา:[^\n]*\n\s*เนื้อหา:\s*([\s\S]*)$/);
    if (csvBody) t = csvBody[1].replace(/^null\s*/, '').trim();

    const startsClean = /^(มาตรา|ข้อ|หมวด|ส่วน|ลักษณะ|บรรพ|\(|[๐-๙\d])/.test(t);
    if (!startsClean) {
        // ถ้ามีหัวมาตราอยู่ใกล้ต้น chunk ให้เริ่มตรงนั้นเลย ไม่งั้นใส่ … บอกว่าเป็นข้อความต่อจากก่อนหน้า
        // ข้าม "ตามมาตรา ๒๖" / "ในมาตรา ๑๔" ซึ่งเป็นการอ้างถึง ไม่ใช่หัวมาตรา
        const header = [...t.slice(0, 160).matchAll(/มาตรา\s*[๐-๙\d]/g)]
            .find(m => m.index > 0 && !/(ตาม|ใน|แห่ง|และ|หรือ|ถึง|ดัง|โดย)\s*$/.test(t.slice(0, m.index)));
        t = header ? t.slice(header.index) : `…${t}`;
    }
    if (!/[.)\]”"]$|นั้น$|แล้ว$|ได้$|บาท$/.test(t)) t = `${t}…`;
    return t;
}
