// ค้นตัวบทรายมาตรา (index lawslane-sections) — หนึ่ง vector ต่อหนึ่งมาตรา มี metadata law_id / law_name / section
// ข้อมูลสร้างโดย scripts/ingest-sections.py · id คำนวณได้จาก (law_id, section, part) จึงดึงมาตราตรง ๆ ได้ด้วย getByIds
import LAWS from './laws.json';

type Law = { id: string; name: string; year?: number };

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const toArabic = (s: string) => s.replace(/[๐-๙]/g, d => String(THAI_DIGITS.indexOf(d)));

// ชื่อย่อที่คนพิมพ์ → ชื่อเต็ม (เทียบบนข้อความที่ตัดช่องว่างแล้ว) · ยาวก่อนสั้น: ป.วิ.อ. ต้องจับก่อน ป.อ.
const ALIASES: Array<[RegExp, string]> = [
    [/ป\.วิ\.อ(?:าญา|\.)/g, 'ประมวลกฎหมายวิธีพิจารณาความอาญา'],
    [/ป\.วิ\.(?:พ\.|แพ่ง)/g, 'ประมวลกฎหมายวิธีพิจารณาความแพ่ง'],
    [/ป\.พ\.พ\./g, 'ประมวลกฎหมายแพ่งและพาณิชย์'],
    [/ป\.อ(?:าญา|\.)/g, 'ประมวลกฎหมายอาญา'],
    [/ป\.ที่ดิน/g, 'ประมวลกฎหมายที่ดิน'],
    [/ป\.รัษฎากร/g, 'ประมวลรัษฎากร'],
    [/พ\.ร\.บ\./g, 'พระราชบัญญัติ'],
    [/พ\.ร\.ก\./g, 'พระราชกำหนด'],
    [/พ\.ร\.ฎ\./g, 'พระราชกฤษฎีกา'],
];

/** ตัดช่องว่าง + เลขไทยเป็นอารบิก + ชื่อย่อเป็นชื่อเต็ม (ใช้ทั้งกับคำถามและชื่อกฎหมาย) */
function compact(s: string): string {
    let t = toArabic(s).replace(/\s+/g, '');
    for (const [re, full] of ALIASES) t = t.replace(re, full);
    return t;
}

// ชื่อกฎหมายตัด "พ.ศ. 2541" ออก — คนมักพิมพ์ชื่อโดยไม่ใส่ปี · ชื่อซ้ำกัน (คนละปี) เก็บฉบับใหม่สุด
const LAW_KEYS: Array<{ key: string; law: Law }> = (() => {
    const byKey = new Map<string, Law>();
    for (const law of LAWS as Law[]) {
        const key = compact(law.name).replace(/พ\.ศ\.\d{4}/g, '').replace(/\(ฉบับที่\d+\)/g, '');
        if (key.length < 8) continue;
        const prev = byKey.get(key);
        if (!prev || (law.year ?? 0) > (prev.year ?? 0)) byKey.set(key, law);
    }
    return [...byKey.entries()].map(([key, law]) => ({ key, law })).sort((a, b) => b.key.length - a.key.length);
})();

const SECTION_RE = /(?:มาตรา|ม\.)(\d+(?:\/\d+)?)(ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|นว|ทศ)?/g;

export type SectionRef = { lawId: string | null; section: string };
export type Refs = { laws: Law[]; sections: SectionRef[] };

/**
 * หาชื่อกฎหมาย + เลขมาตราที่คำถามระบุ — มาตราผูกกับชื่อกฎหมายที่เอ่ยก่อนหน้าใกล้สุด
 * (หรือที่ตามหลัง เช่น "มาตรา 420 แห่ง ป.พ.พ.") · ไม่มีชื่อกฎหมายเลย → lawId = null
 */
export function parseRefs(question: string): Refs {
    const q = compact(question.slice(0, 3000));
    const mentions: Array<{ start: number; end: number; law: Law }> = [];
    for (const { key, law } of LAW_KEYS) {
        for (let at = q.indexOf(key); at >= 0; at = q.indexOf(key, at + key.length)) {
            // ชื่อที่อยู่ในชื่อที่ยาวกว่าซึ่งจับไปแล้ว ("ประมวลกฎหมายอาญา" ใน "ประมวลกฎหมายอาญาทหาร") ไม่นับ
            if (mentions.some(m => at >= m.start && at + key.length <= m.end)) continue;
            mentions.push({ start: at, end: at + key.length, law });
        }
    }
    mentions.sort((a, b) => a.start - b.start);
    const sections: SectionRef[] = [];
    for (const m of q.matchAll(SECTION_RE)) {
        const section = m[1] + (m[2] || '');
        const before = mentions.filter(x => x.end <= m.index!).pop();
        // ต้องอยู่ติดกันพอสมควร ไม่งั้นเป็นชื่อกฎหมายที่เอ่ยในประโยคอื่น
        const after = mentions.find(x => x.start >= m.index! && x.start - m.index! <= 40);
        const law = (after && (!before || after.start - m.index! < m.index! - before.end) ? after : before)?.law ?? null;
        if (!sections.some(s => s.section === section && s.lawId === (law?.id ?? null))) sections.push({ lawId: law?.id ?? null, section });
        if (sections.length >= 6) break;
    }
    const laws = [...new Map(mentions.map(m => [m.law.id, m.law])).values()].slice(0, 3);
    return { laws, sections };
}

/** ต้องตรงกับ section_id() ใน scripts/ingest-sections.py */
export async function sectionId(lawId: string, section: string, part: number): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`sec|${lawId}|${section}|${part}`));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export type Candidate = {
    id: string;
    score: number;          // คะแนน vector (exact = 1)
    rerankScore?: number;
    via: 'exact' | 'section' | 'law' | 'vector' | 'legacy';
    metadata: Record<string, any>;
};

type SearchEnv = { AI: any; VECTORIZE_INDEX: VectorizeIndex; SECTIONS_INDEX: VectorizeIndex };
type SearchInput = { question: string; queries?: string[]; topK?: number; rerank?: boolean; legacy?: boolean };

const PER_QUERY = 15;
const RERANK_MODEL = '@cf/baai/bge-reranker-base';

export async function searchSections(env: SearchEnv, input: SearchInput) {
    const question = input.question.slice(0, 3000);
    const queries = (input.queries || []).filter(q => typeof q === 'string' && q.trim()).slice(0, 6).map(q => q.slice(0, 1500));
    const topK = Math.min(Math.max(Number(input.topK) || 10, 1), 30);
    const refs = parseRefs(question);

    const { data } = await env.AI.run('@cf/baai/bge-m3', { text: [question.slice(0, 2000), ...queries] });
    const [qVec, ...expVecs] = data as number[][];

    const found = new Map<string, Candidate>();
    const add = (via: Candidate['via'], m: { id: string; score?: number; metadata?: any }) => {
        if (!m?.metadata?.text || found.has(m.id)) return;
        found.set(m.id, { id: m.id, score: via === 'exact' ? 1 : m.score ?? 0, via, metadata: m.metadata });
    };

    // 1) มาตราที่ระบุพร้อมชื่อกฎหมาย → getByIds ตรง ๆ (มาตรายาวถูกแบ่งเป็นหลาย part)
    const exactIds = (await Promise.all(refs.sections.filter(r => r.lawId)
        .flatMap(r => [0, 1, 2].map(p => sectionId(r.lawId!, r.section, p)))));
    const lawWithSection = new Set(refs.sections.map(r => r.lawId));
    const jobs: Array<Promise<void>> = [];
    if (exactIds.length > 0) {
        jobs.push(env.SECTIONS_INDEX.getByIds(exactIds).then(vs => {
            // คงลำดับตามที่คำถามเอ่ยถึง
            const byId = new Map(vs.map(v => [v.id, v]));
            for (const id of exactIds) { const v = byId.get(id); if (v) add('exact', v as any); }
        }));
    }
    // 2) มาตราไม่มีชื่อกฎหมาย → ค้นความหมายเฉพาะมาตราเลขนั้นทุกฉบับ
    for (const r of refs.sections.filter(r => !r.lawId)) {
        jobs.push(env.SECTIONS_INDEX.query(qVec, { topK: 3, filter: { section: r.section }, returnMetadata: 'all' })
            .then(res => res.matches.forEach(m => add('section', m))));
    }
    // 3) ชื่อกฎหมายไม่มีเลขมาตรา → ค้นความหมายภายในกฎหมายฉบับนั้น
    for (const law of refs.laws.filter(l => !lawWithSection.has(l.id))) {
        jobs.push(env.SECTIONS_INDEX.query(qVec, { topK: 8, filter: { law_id: law.id }, returnMetadata: 'all' })
            .then(res => res.matches.forEach(m => add('law', m))));
    }
    await Promise.all(jobs);

    // 4) ค้นความหมายทั้ง index ด้วยคำถาม + คำค้นที่ขยายแล้ว · 5) ฎีกาจาก index เดิม (index ใหม่มีแต่ตัวบท)
    const [vectorBatches, legacy] = await Promise.all([
        Promise.all([qVec, ...expVecs].map(v => env.SECTIONS_INDEX.query(v, { topK: PER_QUERY, returnMetadata: 'all' }))),
        input.legacy === false ? Promise.resolve(null) : env.VECTORIZE_INDEX.query(qVec, { topK: 10, returnMetadata: 'all' }),
    ]);
    vectorBatches.forEach(res => res.matches.forEach(m => add('vector', m)));
    legacy?.matches.filter(m => String(m.metadata?.source || '').startsWith('คำพิพากษาฎีกา')).forEach(m => add('legacy', m));

    const candidates = [...found.values()];
    let reranked = false;
    if (input.rerank !== false && candidates.length > 1) {
        try {
            const res = await env.AI.run(RERANK_MODEL, {
                query: question.slice(0, 500),
                contexts: candidates.map(c => ({ text: rerankText(c).slice(0, 1200) })),
                top_k: candidates.length,
            });
            for (const r of res?.response ?? []) {
                if (candidates[r.id]) candidates[r.id].rerankScore = r.score;
            }
            reranked = candidates.some(c => typeof c.rerankScore === 'number');
        } catch (e) {
            // rerank ล้ม → ใช้คะแนน vector ต่อ ไม่ทำให้ AI ล่ม
            console.warn('rerank failed', e instanceof Error ? e.message : e);
        }
    }
    const rank = (c: Candidate) => (reranked ? c.rerankScore ?? -Infinity : c.score);
    // มาตราที่ผู้ใช้ระบุมาเองอยู่บนสุดเสมอ ที่เหลือเรียงตาม reranker
    const exact = candidates.filter(c => c.via === 'exact');
    const rest = candidates.filter(c => c.via !== 'exact').sort((a, b) => rank(b) - rank(a));
    return {
        refs: { laws: refs.laws.map(l => ({ id: l.id, name: l.name })), sections: refs.sections },
        reranked,
        matches: [...exact, ...rest].slice(0, Math.max(topK, exact.length)),
    };
}

function rerankText(c: Candidate): string {
    const md = c.metadata;
    return md.law_name ? `${md.law_name} มาตรา ${md.section}\n${md.text}` : String(md.text);
}
