import { createHash } from 'crypto';

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
