import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import { initAdmin } from '@/lib/firebase-admin';
import { checkLawyerFeature } from '@/lib/lawyer-plan-access';
import { limitUserAction } from '@/lib/security/action-rate-limit';
import { buildCaseContext, getOwnedCase } from '@/lib/lawyer-ai/case-context';
import { findLawSources } from '@/lib/lawyer-ai/sources';
import { retrievalQuery, systemPrompt } from '@/lib/lawyer-ai/prompts';
import {
    ATTACHMENT_MAX_CHARS,
    MESSAGE_MAX_CHARS,
    type AiAttachment,
    type AiCitation,
    type AiMode,
    type AiStreamEvent,
} from '@/lib/lawyer-ai/types';

/**
 * ผู้ช่วย AI งานคดี (Pro/บริษัท) — ถาม-ตอบแบบสตรีม NDJSON (ดู AiStreamEvent)
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

/** วันที่ตามเวลาไทย — โควตารีเซ็ตเที่ยงคืนกรุงเทพฯ */
function bangkokDate() {
    return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function consumeDailyQuota(db: FirebaseFirestore.Firestore, uid: string, limit: number): Promise<boolean> {
    if (limit <= 0) return false;
    const ref = db.collection('lawyerAiUsage').doc(`${uid}_${bangkokDate()}`);
    return db.runTransaction(async tx => {
        const count = Number((await tx.get(ref)).get('count')) || 0;
        if (count >= limit) return false;
        tx.set(ref, { uid, date: bangkokDate(), count: count + 1, updatedAt: Date.now() }, { merge: true });
        return true;
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

    const access = await checkLawyerFeature('aiAssistant');
    if (access.status !== 'ok') return fail(access.status, access.status === 'unauthenticated' ? 401 : 403);
    if (!(await limitUserAction('ai-lawyer-chat', access.uid, 40)).success) return fail('rate-limited', 429);

    let body: Body;
    try {
        body = await req.json();
    } catch {
        return fail('bad-request', 400);
    }
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, MESSAGE_MAX_CHARS) : '';
    const mode: AiMode = MODES.includes(body.mode as AiMode) ? (body.mode as AiMode) : 'ask';
    const attachments = cleanAttachments(body.attachments);
    if (!message && attachments.length === 0) return fail('bad-request', 400);

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
    const adminApp = await initAdmin();
    if (!apiKey || !adminApp) return fail('error', 500);
    const db = adminApp.firestore();
    const uid = access.uid;

    // โควตาคำถามต่อวันตามแพลน (แอดมินตั้งได้ — null = ไม่จำกัด) นับตอนรับคำถาม ไม่ใช่ตอนตอบเสร็จ
    const dailyLimit = access.entitlements.aiMessagesPerDay;
    if (dailyLimit !== null && !(await consumeDailyQuota(db, uid, dailyLimit))) return fail('quota', 429);

    // --- เธรด: ของเดิมต้องเป็นของผู้เรียก · ใหม่ผูกคดีได้เฉพาะคดีของตัวเอง
    let threadRef: FirebaseFirestore.DocumentReference;
    let caseId: string | null = null;
    let isNewThread = false;
    const title = (message || attachments[0]?.name || 'งานใหม่').replace(/\s+/g, ' ').slice(0, 60);
    if (typeof body.threadId === 'string' && body.threadId) {
        threadRef = db.collection('lawyerAiThreads').doc(body.threadId);
        const snap = await threadRef.get();
        if (!snap.exists || snap.get('lawyerUid') !== uid) return fail('bad-request', 404);
        caseId = snap.get('caseId') || null;
    } else {
        if (typeof body.caseId === 'string' && body.caseId) {
            if (!(await getOwnedCase(db, uid, body.caseId))) return fail('bad-request', 404);
            caseId = body.caseId;
        }
        threadRef = db.collection('lawyerAiThreads').doc();
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

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (e: AiStreamEvent) => controller.enqueue(line(e));
            try {
                const now = Date.now();
                if (isNewThread) {
                    await threadRef.set({ lawyerUid: uid, caseId, title, createdAt: now, updatedAt: now });
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

                const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    systemInstruction: systemPrompt(mode, caseContext, citations),
                });
                const result = await model.generateContentStream({
                    contents: [...history, { role: 'user', parts: [{ text: withAttachments(message || 'ช่วยดูเอกสารที่แนบ', attachments) }] }],
                });

                let answer = '';
                for await (const chunk of result.stream) {
                    const text = chunk.text();
                    if (text) {
                        answer += text;
                        send({ type: 'delta', text });
                    }
                }
                if (!answer.trim()) throw new Error('empty answer');

                const saved = await threadRef.collection('messages').add({
                    role: 'model', content: answer, mode, citations, createdAt: Date.now(),
                });
                await threadRef.update({ updatedAt: Date.now() });
                send({ type: 'done', messageId: saved.id });
            } catch (e) {
                console.error('[lawyer-ai] chat failed:', e instanceof Error ? e.message : e);
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
