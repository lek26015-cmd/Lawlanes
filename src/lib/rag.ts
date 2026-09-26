import { createHash } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Use environment variable with fallback to the known deployed URL
const WORKER_URL = process.env.NEXT_PUBLIC_RAG_WORKER_URL || 'https://lawslane-rag-api.lawlanes-app.workers.dev';

// server-only: ห้ามตั้งเป็น NEXT_PUBLIC_ — worker จะบังคับ key นี้เมื่อตั้ง secret RAG_QUERY_KEY แล้ว
export function ragAuthHeaders(): Record<string, string> {
    const key = process.env.RAG_QUERY_KEY;
    return key ? { Authorization: `Bearer ${key}` } : {};
}

export async function retrieveDocuments(query: string, topK: number = 5): Promise<Array<{ source: string, content: string, score: number, year?: number }>> {
    const MAX_RETRIES = 2;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
        try {
            console.log(`[RAG] Querying Cloudflare RAG for: "${query}" (Attempt ${attempt + 1})`);
            
            // Added timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const response = await fetch(`${WORKER_URL}/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...ragAuthHeaders() },
                body: JSON.stringify({ question: query, topK }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Cannot read error text');
                console.error(`[RAG] Error Response: ${response.status} ${response.statusText}`, errorText);
                throw new Error(`Worker returned ${response.status}`);
            }

            const data = await response.json() as any;

            if (!data || !data.matches || data.matches.length === 0) {
                console.warn("[RAG] No matches found in Cloudflare RAG.");
                return [];
            }

            return data.matches.map((match: any) => {
                let content = match.metadata?.text || '';
                
                // --- Simple Thai Text Repair (Heuristic) ---
                // 1. Remove "Tofu" / Box characters that come from PDF extraction
                content = content.replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
                content = content.replace(/□/g, '');
                
                // 2. Fix common "broken" Thai character patterns from encoding issues
                content = content.replace(/([ก-ฮ])\s+([่้๊๋ะาิีึืุูัํ])/g, '$1$2'); // Fix spaces between consonant and vowel/tone
                content = content.replace(/([่้๊๋ะาิีึืุูัํ])\s+([ก-ฮ])/g, '$1$2'); // Fix spaces after vowel/tone
                content = content.replace(/อำ\s+นาจ/g, 'อำนาจ'); // Common word fragment fix
                content = content.replace(/พิจาร\s+ณา/g, 'พิจารณา');
                content = content.replace(/พิ\s+จารณา/g, 'พิจารณา');
                
                // 2.5 บางชุดข้อมูลเก็บ "\\n" เป็นตัวอักษรจริง (ไม่ใช่ขึ้นบรรทัด)
                content = content.replace(/\\n/g, '\n');

                // 3. Clean up excessive whitespace/newlines
                content = content.replace(/\n\s*\n/g, '\n').trim();
                content = content.replace(/[ ]{2,}/g, ' '); // Remove double spaces

                // ปีของกฎหมายสำคัญมาก: ฐานข้อมูลมีทั้งฉบับเดิมและฉบับแก้ไข
                // ถ้าไม่ส่งปีไปด้วย ผู้เรียกจะแยกไม่ออกว่าฉบับไหนยังใช้อยู่
                const rawYear = match.metadata?.year;
                const year = typeof rawYear === 'number'
                    ? rawYear
                    : (typeof rawYear === 'string' && /^\d{4}$/.test(rawYear) ? parseInt(rawYear, 10) : undefined);

                return {
                    source: match.metadata?.source || 'Unknown',
                    content: content,
                    score: match.score || 0,
                    year
                };
            });

        } catch (error) {
            attempt++;
            
            const isTimeout = error instanceof Error && error.name === 'AbortError';
            const errorMsg = isTimeout ? 'Request timeout' : (error instanceof Error ? error.message : String(error));
            
            console.error(`[RAG] Error in retrieveDocuments (URL: ${WORKER_URL}):`, errorMsg);
            
            if (attempt > MAX_RETRIES) {
                console.error(`[RAG] Failed after ${MAX_RETRIES + 1} attempts. Returning empty results.`);
                return [];
            }
            
            // Wait before retrying (exponential backoff: 500ms, 1000ms)
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
    }
    
    return [];
}

export async function retrieveContext(query: string, topK: number = 5): Promise<string> {
    const docs = await retrieveDocuments(query, topK);
    return docs.map(doc => `--- Source: ${doc.source} ---\n${doc.content}`).join('\n\n');
}

// Keep generateIndex as a no-op or remove it, but legal-qa-flow might not call it.
// Actually, legal-qa-flow only calls retrieveContext.
// But I should check if anything else calls generateIndex.
export async function generateIndex(): Promise<void> {
    console.log("Index generation is now handled by Cloudflare Worker ingestion script.");
}


// ---- ชื่อกฎหมายของแต่ละ source ----
// ชุดกฤษฎีกาเก็บชื่อไฟล์เป็นเลข ("พ.ร.บ. กฤษฎีกา/3117.json") ไม่มีชื่อกฎหมายใน metadata
// แต่ chunk แรกของทุกไฟล์ขึ้นต้นด้วยชื่อกฎหมาย และ id ของ chunk คำนวณได้ (md5("kd-{file}-{i}")
// ใน scripts/ingest-krisdika.py) จึงดึง chunk 0 ด้วย /get แล้วตัดชื่อออกมา
const KRISDIKA_SOURCE = /^พ\.ร\.บ\. กฤษฎีกา\/(.+)$/;
const lawTitleCache = new Map<string, string | null>();

const THAI_LAW_CSV_NAMES: Record<string, string> = {
    'Civil and Commercial': 'ประมวลกฎหมายแพ่งและพาณิชย์',
    'Criminal': 'ประมวลกฎหมายอาญา',
    'Civil Procedure': 'ประมวลกฎหมายวิธีพิจารณาความแพ่ง',
    'Criminal Procedure': 'ประมวลกฎหมายวิธีพิจารณาความอาญา',
    'Land': 'ประมวลกฎหมายที่ดิน',
    'Revenue': 'ประมวลรัษฎากร',
};

function titleFromFirstChunk(text: string): string | null {
    // "ประมวลกฎหมายที่ดิน  พระราชบัญญัติ ให้ใช้..." — ชื่อคือข้อความก่อนเว้นวรรคคู่แรก
    const title = text.split(/\s{2,}|\n/)[0]?.trim();
    return title && title.length >= 4 && title.length <= 150 ? title : null;
}

export async function resolveLawTitles(sources: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const missing: Array<{ source: string; id: string }> = [];

    for (const source of new Set(sources)) {
        const csv = source.match(/^ThaiLawCSV\/([^/]+)\/(.+)$/);
        if (csv) {
            const name = THAI_LAW_CSV_NAMES[csv[1]];
            if (name) out.set(source, `${name} มาตรา ${csv[2]}`);
            continue;
        }
        // "กฎหมาย/ประมวลกฎหมายที่ดิน (ฉบับ Update ล่าสุด)/..." — ชื่อกฎหมายอยู่ในโฟลเดอร์ชั้นแรก
        const named = source.match(/^กฎหมาย\/([^/]+)\//);
        if (named) {
            out.set(source, named[1].replace(/\s*\((ฉบับ\s*)?update[^)]*\)/i, '').trim());
            continue;
        }
        const kd = source.match(KRISDIKA_SOURCE);
        if (!kd) continue;
        if (lawTitleCache.has(source)) {
            const cached = lawTitleCache.get(source);
            if (cached) out.set(source, cached);
            continue;
        }
        missing.push({ source, id: createHash('md5').update(`kd-${kd[1]}-0`).digest('hex') });
    }

    if (missing.length > 0) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(`${WORKER_URL}/get`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...ragAuthHeaders() },
                body: JSON.stringify({ ids: missing.slice(0, 20).map(m => m.id) }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                const vectors = await res.json() as Array<{ id: string; metadata?: { text?: string } }>;
                const byId = new Map(vectors.map(v => [v.id, v.metadata?.text || '']));
                for (const m of missing.slice(0, 20)) {
                    const title = titleFromFirstChunk(byId.get(m.id) || '');
                    lawTitleCache.set(m.source, title);
                    if (title) out.set(m.source, title);
                }
            }
        } catch (e) {
            // worker ยังไม่มี /get หรือช้า — ใช้ชื่อแบบเดิมไป ไม่ทำให้แชทล้ม
            console.warn('[RAG] resolveLawTitles failed:', e instanceof Error ? e.message : e);
        }
    }
    return out;
}

// คำถามของลูกความเป็นภาษาชาวบ้าน ("เพื่อนบ้านรุกล้ำที่ดิน") แต่ฐานข้อมูลเป็นภาษาตัวบท
// ("โรงเรือนที่สร้างรุกล้ำเข้าไปในที่ดินของผู้อื่น") ค้นตรง ๆ จึงได้มาตราที่ไม่เกี่ยว
// ให้ Gemini แปลงเป็นคำค้นแบบตัวบทก่อน แล้วค้นหลายรอบพร้อมกัน
export async function expandLegalQueries(question: string): Promise<string[]> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
  if (!apiKey) return [];
  const genAI = new GoogleGenerativeAI(apiKey);
  // 3.5-flash-lite ตอบ ~2 วินาที; 2.5-flash ช้า (3-5 วิ) และ 503 บ่อย จึงเป็นตัวสำรอง
  // (2.5-flash-lite ปิดให้ผู้ใช้ใหม่แล้ว — ตอบ 404) ถ้าพังทั้งคู่ค้นด้วยคำถามเดิมอย่างเดียว
  for (const modelName of ['gemini-3.5-flash-lite', 'gemini-2.5-flash']) {
    const queries = await expandWith(genAI, modelName, question);
    if (queries.length > 0) return queries;
  }
  return [];
}

async function expandWith(genAI: GoogleGenerativeAI, modelName: string, question: string): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    });
    const res = await Promise.race([
      model.generateContent(
        `You help search a database of Thai statute text by meaning. Write 4 search queries for the question below. ` +
        `Each query must read like a phrase that literally appears inside a Thai statute section, e.g. ` +
        `"บุคคลใดสร้างโรงเรือนในที่ดินของผู้อื่นโดยสุจริต" or "ผู้ใดเข้าไปในอสังหาริมทรัพย์ของผู้อื่น". ` +
        `Cover the civil, criminal and procedural/administrative rules that could apply. ` +
        `Do NOT include law names or section numbers. Return JSON {"queries": ["...","...","...","..."]}.\n\nQuestion: ${question}`
      ),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ]);
    const parsed = JSON.parse(res.response.text()) as { queries?: unknown };
    return Array.isArray(parsed.queries)
      ? parsed.queries.filter((q): q is string => typeof q === 'string' && q.trim().length > 0).slice(0, 4)
      : [];
  } catch (e) {
    console.warn(`[RAG] Query expansion with ${modelName} failed:`, e instanceof Error ? e.message : e);
    return [];
  }
}

// ค้นหลายคำค้นพร้อมกัน แล้วรวมผลแบบสลับทีละคำค้น (round-robin) — ถ้าเรียงคะแนนรวมอย่างเดียว
// คำค้นที่ได้คะแนนสูงแต่ตอบแค่มุมเดียว (เช่น อาญา) จะเบียดมุมอื่น (แพ่ง/ที่ดิน) ออกหมด
// ตัดชิ้นซ้ำ (index มี chunk ซ้ำเยอะ) และชิ้นขยะสั้น ๆ ออกก่อน
export async function retrieveExpanded(question: string, perQuery: number = 10, minScore: number = 0.45) {
    const expanded = await expandLegalQueries(question);
    const batches = await Promise.all([question, ...expanded].map(q => retrieveDocuments(q, perQuery)));
    const seen = new Set<string>();
    const usable = (d: { content: string; score: number }) => {
        const compact = d.content.replace(/\s+/g, '');
        // ชุดราชกิจจาฯ มีชิ้นขยะยาว 10-40 ตัวอักษร (เศษหัวกระดาษจาก OCR) ที่คะแนนสูงเกินจริง
        if (compact.length < 60 || d.score <= minScore) return false;
        const key = compact.slice(0, 80);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    };
    // ตัวบทจริง (กฤษฎีกา/ThaiLawCSV/โฟลเดอร์กฎหมาย) มาก่อนคำพิพากษา และประกาศราชกิจจาฯ
    // ประกาศราชกิจจาฯ ส่วนใหญ่เป็นคำสั่ง/ประกาศรายกรณี (เช่น คำสั่งยึดทรัพย์ที่มีชื่อบุคคล)
    // คะแนนความหมายใกล้กับคำถามแต่ไม่ใช่ข้อกฎหมายที่ผู้ใช้ต้องการ
    const weighted = (d: { source: string; score: number }) => {
        if (/^(ThaiLawCSV|พ\.ร\.บ\. กฤษฎีกา|กฎหมาย)\//.test(d.source)) return d.score;
        if (d.source.startsWith('คำพิพากษาฎีกา')) return d.score * 0.95;
        if (d.source.startsWith('ราชกิจจานุเบกษา')) return d.score * 0.85;
        return d.score * 0.9;
    };
    const queues = batches.map(b => [...b].sort((x, y) => weighted(y) - weighted(x)));
    const merged: Awaited<ReturnType<typeof retrieveDocuments>> = [];
    while (queues.some(q => q.length > 0)) {
        for (const q of queues) {
            while (q.length > 0) {
                const d = q.shift()!;
                if (usable(d)) { merged.push(d); break; }
            }
        }
    }
    // เรียงตามประเภทแหล่งข้อมูลโดยคงลำดับ round-robin ในกลุ่มเดียวกัน: ตัวบท → ฎีกา → อื่น ๆ → ราชกิจจาฯ
    const tier = (src: string) =>
        /^(ThaiLawCSV|พ\.ร\.บ\. กฤษฎีกา|กฎหมาย)\//.test(src) ? 0
        : src.startsWith('คำพิพากษาฎีกา') ? 1
        : src.startsWith('ราชกิจจานุเบกษา') ? 3 : 2;
    return merged
        .map((d, i) => ({ d, i }))
        .sort((a, b) => tier(a.d.source) - tier(b.d.source) || a.i - b.i)
        .map(x => x.d);
}
