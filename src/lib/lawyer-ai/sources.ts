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
    const groups = new Map<string, AiCitation>();
    for (const r of top) {
        const title = titles.get(r.source) || sourceLabel(r.source);
        // หาชื่อไม่ได้ ("เอกสารกฎหมาย") → แยกตาม source ไม่งั้นเอกสารคนละฉบับถูกรวมกัน
        const key = titles.has(r.source) ? `${title}|${r.year ?? ''}` : r.source;
        const content = tidyExcerpt(r.content);
        const g = groups.get(key);
        if (g) {
            if (g.content.length < 4000) g.content += `\n\n${content}`;
        } else if (groups.size < limit) {
            groups.set(key, { n: groups.size + 1, title, type: sourceType(r.source), year: r.year, content });
        }
    }
    return [...groups.values()];
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
