import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import { getAiAccess, parseAudience } from '@/lib/lawyer-ai/access';
import { limitUserAction } from '@/lib/security/action-rate-limit';
import { buildCaseContext, getOwnedCase } from '@/lib/lawyer-ai/case-context';
import { findLawSources } from '@/lib/lawyer-ai/sources';
import { retrievalQuery, systemPrompt } from '@/lib/lawyer-ai/prompts';
import { consumeCredits, refundCredits } from '@/lib/lawyer-ai/credits';
import { AI_CREDIT_COST } from '@/lib/lawyer-entitlements';
import { AI_MODEL_ATTEMPTS, isRetryableAiError } from '@/lib/lawyer-ai/models';
import {
    ATTACHMENT_MAX_CHARS,
    MESSAGE_MAX_CHARS,
    type AiAttachment,
    type AiCitation,
    type AiMode,
    type AiStreamEvent,
} from '@/lib/lawyer-ai/types';

/**
 * ผู้ช่วย AI กฎหมาย (ทนาย + ลูกค้าทั่วไป) — ถาม-ตอบแบบสตรีม NDJSON (ดู AiStreamEvent)
 * ใช้ route handler แทน server action เพราะคำตอบยาวและ Gemini ใช้เวลานาน ต้องทยอยส่งให้เห็นระหว่างเขียน
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

const MODES: AiMode[] = ['ask', 'statute', 'judgment', 'draft', 'contract'];
const HISTORY_TURNS = 12;
const HISTORY_ATTACHMENT_BUDGET = 80_000;

type Body = {
    threadId?: unknown;
    caseId?: unknown;
    audience?: unknown;
    mode?: unknown;
    message?: unknown;
    attachments?: unknown;
};

function cleanAttachments(raw: unknown): AiAttachment[] {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 5).flatMap(a => {
        if (!a || typeof a !== 'object') return [];
        const { name, mimeType, text } = a as Record<string, unknown>;
        if (typeof text !== 'string' || !text.trim()) return [];
        return [{
            name: String(name || 'ไฟล์แนบ').slice(0, 200),
            mimeType: String(mimeType || '').slice(0, 100),
            text: text.slice(0, ATTACHMENT_MAX_CHARS),
        }];
    });
}

function withAttachments(text: string, attachments: AiAttachment[]): string {
    if (attachments.length === 0) return text;
    const files = attachments.map(a => `--- เอกสารแนบ: ${a.name} ---\n${a.text}\n--- จบเอกสารแนบ: ${a.name} ---`).join('\n\n');
    return `${files}\n\n${text}`;
}

export async function POST(req: Request) {
    const encoder = new TextEncoder();
    const line = (e: AiStreamEvent) => encoder.encode(JSON.stringify(e) + '\n');
    const fail = (code: Extract<AiStreamEvent, { type: 'error' }>['code'], status: number) =>
        new Response(JSON.stringify({ type: 'error', code } satisfies AiStreamEvent) + '\n', {
            status,
            headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
        });

    let body: Body;
    try {
        body = await req.json();
    } catch {
        return fail('bad-request', 400);
    }
    // ทนายหรือลูกค้า — สิทธิ์และเครดิตตัดสินที่ server ตาม audience (ลูกค้าทั่วไปส่ง 'lawyer' มาก็ไม่ผ่านด่านทนาย)
    const audience = parseAudience(body.audience);
    const access = await getAiAccess(audience);
    if (access.status !== 'ok') return fail(access.status, access.status === 'unauthenticated' ? 401 : 403);
    if (!(await limitUserAction(`ai-chat-${audience}`, access.uid, 40)).success) return fail('rate-limited', 429);
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, MESSAGE_MAX_CHARS) : '';
    const mode: AiMode = MODES.includes(body.mode as AiMode) ? (body.mode as AiMode) : 'ask';
    const attachments = cleanAttachments(body.attachments);
    if (!message && attachments.length === 0) return fail('bad-request', 400);

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
    if (!apiKey) return fail('error', 500);
    const { db, uid } = access;
    const account = { audience, uid };


    // --- เธรด: ของเดิมต้องเป็นของผู้เรียก · ใหม่ผูกคดีได้เฉพาะคดีของตัวเอง
    let threadRef: FirebaseFirestore.DocumentReference;
    let caseId: string | null = null;
    let isNewThread = false;
    const title = (message || attachments[0]?.name || 'งานใหม่').replace(/\s+/g, ' ').slice(0, 60);
    if (typeof body.threadId === 'string' && body.threadId) {
        threadRef = db.collection('aiThreads').doc(body.threadId);
        const snap = await threadRef.get();
        if (!snap.exists || snap.get('ownerUid') !== uid || snap.get('audience') !== audience) return fail('bad-request', 404);
        caseId = access.canUseCases ? snap.get('caseId') || null : null;
    } else {
        // แฟ้มคดีเป็นของทนายเท่านั้น
        if (access.canUseCases && typeof body.caseId === 'string' && body.caseId) {
            if (!(await getOwnedCase(db, uid, body.caseId))) return fail('bad-request', 404);
            caseId = body.caseId;
        }
        threadRef = db.collection('aiThreads').doc();
        isNewThread = true;
    }

    const legalCase = caseId ? await getOwnedCase(db, uid, caseId) : null;
    // คดีถูกลบ/โอนไปแล้ว → ตอบต่อได้แต่ไม่มีบริบทคดี
    const [caseContext, historySnap] = await Promise.all([
        legalCase ? buildCaseContext(db, legalCase.id, legalCase.data) : Promise.resolve(null),
        isNewThread ? Promise.resolve(null) : threadRef.collection('messages').orderBy('createdAt', 'desc').limit(HISTORY_TURNS).get(),
    ]);

    const history: Content[] = [];
    let budget = HISTORY_ATTACHMENT_BUDGET;
    for (const d of [...(historySnap?.docs ?? [])].reverse()) {
        const m = d.data();
        let text = String(m.content || '');
        if (m.role === 'user' && Array.isArray(m.attachments)) {
            // ไฟล์ที่แนบไว้ในข้อความก่อน ๆ ยังต้องอยู่ในบริบท (เช่น "ข้อ 5 ในสัญญานี้แก้ยังไง")
            const kept = (m.attachments as AiAttachment[]).filter(a => {
                if (budget - a.text.length < 0) return false;
                budget -= a.text.length;
                return true;
            });
            text = withAttachments(text, kept);
        }
        if (text) history.push({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text }] });
    }
    // Gemini ต้องเริ่มด้วย user เสมอ
    while (history.length > 0 && history[0].role !== 'user') history.shift();

    // หักเครดิตหลังตรวจเธรด/คดีผ่านแล้ว ก่อนเรียก AI (คืนให้ถ้าตอบไม่สำเร็จ) — เครดิตรายเดือนตามแพลน แล้วค่อยเครดิตที่ซื้อเพิ่ม
    const monthly = access.monthlyCredits;
    const cost = AI_CREDIT_COST[mode];
    const credit = await consumeCredits(db, account, monthly, cost, 'chat', { mode });
    if (!credit.ok) return fail('insufficient-credits', 402);

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (e: AiStreamEvent) => controller.enqueue(line(e));
            try {
                const now = Date.now();
                if (isNewThread) {
                    await threadRef.set({ ownerUid: uid, audience, caseId, title, createdAt: now, updatedAt: now });
                }
                send({ type: 'thread', threadId: threadRef.id, title: isNewThread ? title : '' });

                let citations: AiCitation[] = [];
                try {
                    const q = retrievalQuery(mode, message, legalCase ? String(legalCase.data.title || '') : null, attachments.map(a => a.text).join('\n'));
                    citations = await findLawSources(q, mode);
                } catch (e) {
                    // ค้นฐานข้อมูลไม่ได้ก็ยังตอบได้ (prompt บอก AI ว่าไม่มีแหล่งอ้างอิง)
                    console.warn('[lawyer-ai] retrieval failed:', e instanceof Error ? e.message : e);
                }
                send({ type: 'citations', citations });

                await threadRef.collection('messages').add({
                    role: 'user', content: message, mode, attachments, createdAt: now,
                });

                const genAI = new GoogleGenerativeAI(apiKey);
                const systemInstruction = systemPrompt(audience, mode, caseContext, citations);
                const contents = [...history, { role: 'user', parts: [{ text: withAttachments(message || 'ช่วยดูเอกสารที่แนบ', attachments) }] }];

                // Gemini ตอบ 503 "high demand" เป็นช่วง ๆ — ถ้ายังไม่ได้ส่งข้อความสักตัว ลองใหม่/สลับรุ่นสำรองได้
                // ส่งไปบางส่วนแล้วห้ามลองใหม่ (ผู้ใช้จะเห็นคำตอบซ้ำซ้อน) ให้ถือว่าล้มแล้วคืนเครดิต
                let answer = '';
                let lastError: unknown = null;
                for (const [i, modelName] of AI_MODEL_ATTEMPTS.entries()) {
                    if (i > 0) await new Promise(r => setTimeout(r, 1200));
                    try {
                        const model = genAI.getGenerativeModel({ model: modelName, systemInstruction });
                        const result = await model.generateContentStream({ contents });
                        for await (const chunk of result.stream) {
                            const text = chunk.text();
                            if (text) {
                                answer += text;
                                send({ type: 'delta', text });
                            }
                        }
                        break;
                    } catch (e) {
                        lastError = e;
                        console.warn(`[lawyer-ai] ${modelName} failed:`, e instanceof Error ? e.message.slice(0, 160) : e);
                        if (answer || !isRetryableAiError(e)) throw e;
                    }
                }
                if (!answer.trim()) throw lastError ?? new Error('empty answer');

                const saved = await threadRef.collection('messages').add({
                    role: 'model', content: answer, mode, citations: JSON.parse(JSON.stringify(citations)), createdAt: Date.now(),
                });
                await threadRef.update({ updatedAt: Date.now() });
                send({ type: 'done', messageId: saved.id, credits: credit.status });
            } catch (e) {
                console.error('[lawyer-ai] chat failed:', e instanceof Error ? e.message : e);
                await refundCredits(db, account, credit.charge, 'chat-failed', { mode, threadId: threadRef.id });
                send({ type: 'error', code: 'error' });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Accel-Buffering': 'no',
        },
    });
}
