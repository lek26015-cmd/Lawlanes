import 'server-only';

import { retrieveExpanded, resolveLawTitles } from '@/lib/rag';
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
    const groups = new Map<string, { citation: Omit<AiCitation, 'content'>; chunks: string[] }>();
    for (const r of top) {
        const title = titles.get(r.source) || sourceLabel(r.source);
        // หาชื่อไม่ได้ ("เอกสารกฎหมาย") → แยกตาม source ไม่งั้นเอกสารคนละฉบับถูกรวมกัน
        const key = titles.has(r.source) ? `${title}|${r.year ?? ''}` : r.source;
        const g = groups.get(key);
        if (g) g.chunks.push(r.content);
        else if (groups.size < limit) {
            // ไม่ใส่ year เมื่อไม่มีค่า — Firestore ไม่รับ undefined (บันทึกข้อความลงเธรดจะล้ม)
            groups.set(key, { citation: { n: groups.size + 1, title, type: sourceType(r.source), ...(r.year ? { year: r.year } : {}) }, chunks: [r.content] });
        }
    }
    return [...groups.values()].map(g => ({ ...g.citation, content: mergeChunks(g.chunks) }));
}

const THAI_DIGIT = '๐๑๒๓๔๕๖๗๘๙';
// หัวมาตรา — ไม่นับ "ตามมาตรา ๒๖" / "โดยมาตรา ๔ แห่ง…" ซึ่งเป็นการอ้างถึง
const SECTION_HEAD = /มาตรา\s*([๐-๙\d]+(?:\/[๐-๙\d]+)?)(?:\s*(ทวิ|ตรี|จัตวา|เบญจ))?/g;
const REFERENCE_BEFORE = /(ตาม|ใน|แห่ง|และ|หรือ|ถึง|ดัง|โดย|,)\s*$/;
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
    const sections = new Map<string, { order: number; text: string; cut: boolean }>();
    const loose: string[] = [];
    for (const raw of chunks) {
        const text = cleanChunk(raw);
        const heads = [...text.matchAll(SECTION_HEAD)].filter(m => !REFERENCE_BEFORE.test(text.slice(0, m.index)));
        if (heads.length === 0) {
            loose.push(tidyExcerpt(raw));
            continue;
        }
        heads.forEach((m, i) => {
            const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
            const body = text.slice(m.index, end).trim();
            const num = m[1] + (m[2] ? ` ${m[2]}` : '');
            // มาตราสุดท้ายของ chunk อาจถูกตัดกลางคำ — ถ้าไม่มีฉบับเต็มจาก chunk อื่นจะใส่ … ต่อท้าย
            const cut = i === heads.length - 1 && !ENDS_CLEAN.test(body);
            const prev = sections.get(num);
            if (!prev || body.length > prev.text.length) sections.set(num, { order: sectionOrder(m[1]), text: body, cut });
        });
    }
    const ordered = [...sections.values()].sort((a, b) => a.order - b.order).map(s => (s.cut ? `${s.text}…` : s.text));
    return [...ordered, ...loose].join('\n').slice(0, 6000);
}

const ENDS_CLEAN = /([.)\]”"]|นั้น|แล้ว|ได้|บาท|ด้วย|นี้|ก็ได้|ปรับ|ไม่ได้|เป็นต้น)$/;

function cleanChunk(text: string): string {
    let t = text
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
