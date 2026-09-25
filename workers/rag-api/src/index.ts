
export interface Env {
    VECTORIZE_INDEX: VectorizeIndex;
    AI: any;
    // ตั้งด้วย `wrangler secret put` เท่านั้น ห้ามใส่ใน wrangler.toml (repo เป็น public)
    // RAG_INGEST_KEY: ต้องมีเสมอ — ถ้าไม่ได้ตั้ง /ingest กับ /exists จะปิด (fail closed)
    // RAG_QUERY_KEY: ถ้าตั้งไว้ /query กับ /stats จะต้องส่ง key ด้วย
    //   (แยกไว้เพื่อให้ทุกแอป deploy header ก่อน แล้วค่อยตั้ง secret ทีหลังโดยไม่ทำให้ AI ล่ม)
    RAG_INGEST_KEY?: string;
    RAG_QUERY_KEY?: string;
}

const MAX_TEXT_LENGTH = 20_000;
const MAX_TOP_K = 20;

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// เทียบแบบเวลาคงที่ กันเดา key ทีละตัวอักษรจากเวลาตอบ
// hash ก่อนให้ความยาวเท่ากันเสมอ (timingSafeEqual ต้องการความยาวเท่ากัน)
async function safeEqual(a: string, b: string): Promise<boolean> {
    const enc = new TextEncoder();
    const [x, y] = await Promise.all([
        crypto.subtle.digest('SHA-256', enc.encode(a)),
        crypto.subtle.digest('SHA-256', enc.encode(b)),
    ]);
    return (crypto.subtle as any).timingSafeEqual(x, y);
}

function bearer(request: Request): string {
    const h = request.headers.get("Authorization") || "";
    return h.startsWith("Bearer ") ? h.slice(7) : "";
}

// คืน Response ถ้าไม่ผ่าน, คืน null ถ้าผ่าน
async function requireKey(request: Request, expected: string | undefined, required: boolean): Promise<Response | null> {
    if (!expected) {
        return required ? json({ error: "Endpoint disabled: key not configured" }, 503) : null;
    }
    const got = bearer(request);
    if (!got || !(await safeEqual(got, expected))) return json({ error: "Unauthorized" }, 401);
    return null;
}

export default {
    async fetch(request: Request, env: Env) {
        const url = new URL(request.url);

        if (request.method === 'POST' && url.pathname === '/ingest') {
            const denied = await requireKey(request, env.RAG_INGEST_KEY, true);
            if (denied) return denied;
            try {
                const { text, metadata, id: providedId } = await request.json() as any;
                if (!text || typeof text !== 'string') return new Response("Missing text", { status: 400 });
                if (text.length > MAX_TEXT_LENGTH) return new Response("Text too long", { status: 413 });

                const { data } = await env.AI.run('@cf/baai/bge-m3', { text: [text] });
                const values = data[0];

                if (!values) return new Response("Failed to generate embeddings", { status: 500 });

                const id = providedId || crypto.randomUUID();
                await env.VECTORIZE_INDEX.upsert([{
                    id,
                    values,
                    metadata: metadata || {}
                }]);

                return json({ id, status: "indexed" });
            } catch (e: any) {
                return new Response(`Error: ${e.message}`, { status: 500 });
            }
        }

        if (request.method === 'POST' && url.pathname === '/query') {
            const denied = await requireKey(request, env.RAG_QUERY_KEY, false);
            if (denied) return denied;
            try {
                const { question, filter, topK: requestedTopK } = await request.json() as any;
                if (!question || typeof question !== 'string') return new Response("Missing question", { status: 400 });
                if (question.length > MAX_TEXT_LENGTH) return new Response("Question too long", { status: 413 });

                const { data } = await env.AI.run('@cf/baai/bge-m3', { text: [question] });
                const values = data[0];

                if (!values) return new Response("Failed to generate embeddings", { status: 500 });

                // filter/topK มาจาก lawslane-admin เวอร์ชัน — find-lawyers-flow ส่ง { type: 'lawyer' } มา
                // ตัวที่ deploy อยู่เดิมไม่สนใจ filter เลย จึงได้เอกสารกฎหมายปนกับโปรไฟล์ทนาย
                const topK = Math.min(Math.max(Number(requestedTopK) || 5, 1), MAX_TOP_K);
                const queryOptions: any = { topK, returnMetadata: true };
                if (filter && typeof filter === 'object') queryOptions.filter = filter;

                const searchResult = await env.VECTORIZE_INDEX.query(values, queryOptions);

                return json(searchResult);
            } catch (e: any) {
                return new Response(`Error: ${e.message}`, { status: 500 });
            }
        }

        if (request.method === 'POST' && url.pathname === '/exists') {
            // ใช้โดยสคริปต์ ingestion เท่านั้น
            const denied = await requireKey(request, env.RAG_INGEST_KEY, true);
            if (denied) return denied;
            try {
                const { id } = await request.json() as any;
                if (!id) return new Response("Missing id", { status: 400 });

                const vectors = await env.VECTORIZE_INDEX.getByIds([id]);
                const exists = vectors.length > 0;

                return json({ exists });
            } catch (e: any) {
                return new Response(`Error: ${e.message}`, { status: 500 });
            }
        }

        if (request.method === 'POST' && url.pathname === '/get') {
            // อ่าน metadata ตาม id (ไม่เกิน 20) — ใช้หาชื่อกฎหมายจาก chunk แรกของแต่ละไฟล์
            // เปิดเผยข้อมูลไม่เกินที่ /query ให้อยู่แล้ว จึงใช้ key เดียวกับ /query
            const denied = await requireKey(request, env.RAG_QUERY_KEY, false);
            if (denied) return denied;
            try {
                const { ids } = await request.json() as any;
                if (!Array.isArray(ids) || ids.length === 0) return new Response("Missing ids", { status: 400 });
                const clean = ids.filter((id: unknown) => typeof id === 'string' && id.length <= 64).slice(0, 20);
                const vectors = await env.VECTORIZE_INDEX.getByIds(clean);
                return json(vectors.map((v: any) => ({ id: v.id, metadata: v.metadata || {} })));
            } catch (e: any) {
                return new Response(`Error: ${e.message}`, { status: 500 });
            }
        }

        if (request.method === 'GET' && url.pathname === '/stats') {
            const denied = await requireKey(request, env.RAG_QUERY_KEY, false);
            if (denied) return denied;
            try {
                const info = await env.VECTORIZE_INDEX.describe();
                return json(info);
            } catch (e: any) {
                return new Response(`Error: ${e.message}`, { status: 500 });
            }
        }

        if (request.method === 'GET' && url.pathname === '/health') {
            return json({ status: 'ok', service: 'lawslane-rag-api' });
        }

        return new Response("Not Found", { status: 404 });
    }
};
