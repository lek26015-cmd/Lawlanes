/**
 * วัด recall@k ของมาตราเฉลย ผ่าน retrieveExpanded (ตัวเดียวกับที่ /api/lawyer-ai/chat ใช้ผ่าน findLawSources)
 *
 *   npx tsx scripts/rag-eval/recall.mts --env ../Lawslane/.env.local [--modes old,new,new-norerank] [--limit N]
 *
 * env ที่ใช้: GOOGLE_API_KEY (ขยายคำค้น), NEXT_PUBLIC_RAG_WORKER_URL / RAG_QUERY_KEY (worker ที่จะวัด — ชี้ไป staging ได้)
 *   old          = /query บน lawslane-index (ระบบเดิม)
 *   new          = /search บน lawslane-sections + ค้นมาตราตรง + rerank
 *   new-norerank = เหมือน new แต่เรียงด้วยคะแนน vector
 * คำค้นที่ Gemini ขยายถูก cache ไว้ใน data/expansions.json ให้ทุกโหมดใช้ชุดเดียวกัน (เทียบกันได้ยุติธรรม)
 *
 * การนับว่า "เจอมาตรา" ของเอกสารแต่ละชิ้น:
 *   - index ใหม่: law_name + section จาก metadata (หนึ่งชิ้น = หนึ่งมาตรา)
 *   - index เดิม: ชื่อกฎหมายจาก resolveLawTitles + ทุก "มาตรา n" ที่ปรากฏในเนื้อหา chunk
 *     (chunk 1,000 ตัวอักษรมักครอบหลายมาตรา และนับรวมการอ้างถึงด้วย — เอื้อระบบเดิม)
 *   - ฎีกา/ราชกิจจาฯ ไม่นับเป็นการเจอตัวบท
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
};
const envFile = arg('env') || '.env.local';
for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || m[1] in process.env) continue;
    process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
}

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const questions: Array<{ id: string; set: string; question: string; gold: Array<{ law: string; section: string }> }> =
    JSON.parse(fs.readFileSync(arg('set') || path.join(dataDir, 'questions.json'), 'utf8')).slice(0, Number(arg('limit')) || undefined);
const modes = (arg('modes') || 'old,new,new-norerank').split(',');
const KS = [5, 10];

// rag.ts log ทุกคำค้น (รวมโจทย์ยาวทั้งก้อน) — ปิดไว้ ผลลัพธ์พิมพ์ด้วย print
const print = console.log.bind(console);
console.log = () => {};
// import หลังตั้ง env — rag.ts อ่าน WORKER_URL ตอนโหลดโมดูล
const { retrieveExpanded, expandLegalQueries, resolveLawTitles } = await import('../../src/lib/rag');

const THAI = '๐๑๒๓๔๕๖๗๘๙';
const arabic = (s: string) => s.replace(/[๐-๙]/g, d => String(THAI.indexOf(d)));
const normLaw = (s: string) => arabic(s).replace(/\s+/g, '').replace(/พ\.ศ\.\d{4}/g, '').replace(/\(ฉบับ[^)]*\)/g, '');
const normSec = (s: string) => arabic(s).replace(/\s+/g, '');
const SECTION = /มาตรา\s*([๐-๙\d]+(?:\s*\/\s*[๐-๙\d]+)?)(\s*(?:ทวิ|ตรี|จัตวา|เบญจ))?/g;
// ตรงกับ findLawSources: ค้นด้วยข้อความ 1,500 ตัวอักษรแรก
const asQuery = (q: string) => q.trim().slice(0, 1500);

const expPath = path.join(dataDir, 'expansions.json');
const expansions: Record<string, string[]> = fs.existsSync(expPath) ? JSON.parse(fs.readFileSync(expPath, 'utf8')) : {};
for (const q of questions) {
    if (expansions[q.id]) continue;
    expansions[q.id] = await expandLegalQueries(asQuery(q.question));
    fs.writeFileSync(expPath, JSON.stringify(expansions, null, 2));
}
const noExpansion = questions.filter(q => expansions[q.id].length === 0).length;
if (noExpansion) console.warn(`⚠️ ${noExpansion} ข้อขยายคำค้นไม่ได้ (Gemini ล้ม) — ค้นด้วยคำถามเดิมอย่างเดียว`);

type Doc = Awaited<ReturnType<typeof retrieveExpanded>>[number];

async function refsOf(docs: Doc[]): Promise<Set<string>[]> {
    const titles = await resolveLawTitles(docs.map(d => d.source));
    return docs.map(d => {
        if (d.lawName && d.section) return new Set([`${normLaw(d.lawName)}|${normSec(d.section)}`]);
        if (/^(คำพิพากษาฎีกา|ราชกิจจานุเบกษา)/.test(d.source)) return new Set<string>();
        let title = titles.get(d.source) || d.source.split('/').pop()!.replace(/\.(pdf|json|txt)$/i, '');
        const own = title.match(/^(.*?)\s*มาตรา\s*(\S+)$/); // ThaiLawCSV → "ชื่อ มาตรา n"
        const out = new Set<string>();
        if (own) {
            title = own[1];
            out.add(`${normLaw(title)}|${normSec(own[2])}`);
        }
        for (const m of d.content.matchAll(SECTION)) out.add(`${normLaw(title)}|${normSec(m[1] + (m[2] || ''))}`);
        return out;
    });
}

type Row = { id: string; set: string; mode: string; hits: Record<number, number>; gold: number; top: string[] };
const rows: Row[] = [];
for (const mode of modes) {
    let n = 0;
    for (const q of questions) {
        const docs = (await retrieveExpanded(asQuery(q.question), 10, 0.45, {
            expanded: expansions[q.id],
            sectionSearch: mode !== 'old',
            rerank: mode !== 'new-norerank',
        })).slice(0, Math.max(...KS));
        const refs = await refsOf(docs);
        const gold = [...new Set(q.gold.map(g => `${normLaw(g.law)}|${normSec(g.section)}`))];
        const hits: Record<number, number> = {};
        for (const k of KS) {
            const seen = new Set(refs.slice(0, k).flatMap(r => [...r]));
            hits[k] = gold.filter(g => seen.has(g)).length;
        }
        rows.push({ id: q.id, set: q.set, mode, hits, gold: gold.length, top: docs.slice(0, 5).map(d => d.lawName ? `${d.lawName} ม.${d.section}` : d.source) });
        if (++n % 10 === 0) console.error(`  ${mode}: ${n}/${questions.length}`);
    }
}
fs.writeFileSync(path.join(dataDir, `results-${new Date().toISOString().slice(0, 16).replace(/:/g, '')}.json`), JSON.stringify(rows, null, 2));

const sets = ['ทั้งหมด', ...new Set(questions.map(q => q.set))];
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
print(`\n${questions.length} ข้อ · recall@k = สัดส่วนมาตราเฉลยที่อยู่ใน k อันดับแรก (เฉลี่ยรายข้อ) · hit@k = มีมาตราเฉลยอย่างน้อยหนึ่งมาตรา\n`);
print(['ชุด', 'n', ...modes.flatMap(m => KS.flatMap(k => [`${m} R@${k}`, `${m} hit@${k}`]))].join('\t'));
for (const s of sets) {
    const qs = s === 'ทั้งหมด' ? questions : questions.filter(q => q.set === s);
    const cells = modes.flatMap(m => KS.flatMap(k => {
        const rs = rows.filter(r => r.mode === m && qs.some(q => q.id === r.id));
        return [pct(rs.reduce((a, r) => a + r.hits[k] / r.gold, 0) / rs.length), pct(rs.filter(r => r.hits[k] > 0).length / rs.length)];
    }));
    print([s, qs.length, ...cells].join('\t'));
}
