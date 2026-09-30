'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { limitUserAction } from '@/lib/security/action-rate-limit';
import { listCaseFolders } from '@/lib/lawyer-ai/case-context';
import { getAiAccess, parseAudience } from '@/lib/lawyer-ai/access';
import { consumeCredits, getCreditStatus, refundCredits, type CreditCharge } from '@/lib/lawyer-ai/credits';
import { AI_CREDIT_COST, type AiCreditStatus } from '@/lib/lawyer-entitlements';
import {
    ATTACHMENT_MAX_BYTES,
    ATTACHMENT_MAX_CHARS,
    type AiAttachment,
    type AiAudience,
    type AiCaseFolder,
    type AiMessage,
    type AiThreadSummary,
} from '@/lib/lawyer-ai/types';

/**
 * ผู้ช่วย AI กฎหมาย — ทนาย (/lawyer-dashboard/ai) และลูกค้าทั่วไป (/ai) ใช้ชุดเดียวกัน แยกด้วย audience
 * สิทธิ์ตัดสินที่ server (lib/lawyer-ai/access.ts) · เธรดของใครของมัน (ownerUid + audience)
 * การถาม-ตอบอยู่ที่ /api/lawyer-ai/chat (สตรีม) ไฟล์นี้คือรายการแฟ้มคดี/เธรด และการอ่านไฟล์แนบ
 */

type Locked = { status: 'unauthenticated' | 'not-lawyer' | 'upgrade-required' };

function ownsThread(snap: FirebaseFirestore.DocumentSnapshot, uid: string, audience: AiAudience) {
    return snap.exists && snap.get('ownerUid') === uid && snap.get('audience') === audience;
}

export async function getAiWorkspaceAction(rawAudience: AiAudience): Promise<
    { status: 'ok'; cases: AiCaseFolder[]; threads: AiThreadSummary[]; credits: AiCreditStatus } | Locked
> {
    const audience = parseAudience(rawAudience);
    const access = await getAiAccess(audience);
    if (access.status !== 'ok') return access;
    const { db, uid } = access;
    const [cases, credits, threadSnap] = await Promise.all([
        access.canUseCases ? listCaseFolders(db, uid) : Promise.resolve([]),
        getCreditStatus(db, { audience, uid }, access.monthlyCredits),
        // equality สองฟิลด์ใช้ single-field index ได้ ไม่ใช้ orderBy (ต้องสร้าง composite index บน Firebase production)
        // เรียงในหน่วยความจำแทน — ผู้ใช้หนึ่งคนมีเธรดไม่มาก
        db.collection('aiThreads').where('ownerUid', '==', uid).where('audience', '==', audience).limit(500).get(),
    ]);
    const threads = threadSnap.docs
        .map(d => ({
            id: d.id,
            title: String(d.get('title') || 'งานใหม่'),
            caseId: (d.get('caseId') as string | null) || null,
            updatedAt: Number(d.get('updatedAt')) || 0,
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 100);
    return { status: 'ok', cases, threads, credits };
}

export async function getAiThreadAction(rawAudience: AiAudience, threadId: string): Promise<
    { status: 'ok'; thread: AiThreadSummary; messages: AiMessage[] } | Locked | { status: 'not-found' }
> {
    const audience = parseAudience(rawAudience);
    const access = await getAiAccess(audience);
    if (access.status !== 'ok') return access;
    const ref = access.db.collection('aiThreads').doc(String(threadId));
    const snap = await ref.get();
    if (!ownsThread(snap, access.uid, audience)) return { status: 'not-found' };

    const msgSnap = await ref.collection('messages').orderBy('createdAt', 'asc').limit(200).get();
    const messages: AiMessage[] = msgSnap.docs.map(d => {
        const m = d.data();
        return {
            id: d.id,
            role: m.role === 'model' ? 'model' : 'user',
            content: String(m.content || ''),
            mode: m.mode || 'ask',
            citations: Array.isArray(m.citations) ? m.citations : undefined,
            // ข้อความเต็มของไฟล์ไม่ต้องส่งกลับไปที่ browser
            attachments: Array.isArray(m.attachments)
                ? m.attachments.map((a: AiAttachment) => ({ name: a.name, mimeType: a.mimeType }))
                : undefined,
            createdAt: Number(m.createdAt) || 0,
        };
    });
    return {
        status: 'ok',
        thread: { id: snap.id, title: String(snap.get('title') || 'งานใหม่'), caseId: snap.get('caseId') || null, updatedAt: Number(snap.get('updatedAt')) || 0 },
        messages,
    };
}

export async function deleteAiThreadAction(rawAudience: AiAudience, threadId: string): Promise<{ status: 'ok' | 'not-found' } | Locked> {
    const audience = parseAudience(rawAudience);
    const access = await getAiAccess(audience);
    if (access.status !== 'ok') return access;
    const ref = access.db.collection('aiThreads').doc(String(threadId));
    if (!ownsThread(await ref.get(), access.uid, audience)) return { status: 'not-found' };
    await access.db.recursiveDelete(ref);
    return { status: 'ok' };
}

const GEMINI_READABLE = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

/**
 * อ่านข้อความจากไฟล์แนบ (PDF / รูป / .txt) — PDF และรูปให้ Gemini ถอดข้อความ (รองรับเอกสารสแกน)
 * ไม่เก็บตัวไฟล์ เก็บแค่ข้อความที่ถอดได้ไว้ใน message ตอนส่งคำถาม
 */
export async function readAttachmentAction(rawAudience: AiAudience, formData: FormData): Promise<
    { status: 'ok'; attachment: AiAttachment; credits?: AiCreditStatus } | Locked
    | { status: 'rate-limited' | 'too-large' | 'unsupported' | 'empty' | 'error' | 'insufficient-credits' }
> {
    const audience = parseAudience(rawAudience);
    const access = await getAiAccess(audience);
    if (access.status !== 'ok') return access;
    const { db, uid } = access;
    if (!(await limitUserAction('ai-attachment', uid, 30)).success) return { status: 'rate-limited' };

    const file = formData.get('file');
    if (!(file instanceof File)) return { status: 'unsupported' };
    if (file.size > ATTACHMENT_MAX_BYTES) return { status: 'too-large' };
    const name = file.name.slice(0, 200) || 'ไฟล์แนบ';
    const mimeType = file.type || '';

    let charge: CreditCharge | null = null;
    let credits: AiCreditStatus | undefined;
    const refund = () => charge && refundCredits(db, { audience, uid }, charge, 'attachment-failed', { name });

    try {
        let text = '';
        if (mimeType.startsWith('text/')) {
            text = await file.text();
        } else if (GEMINI_READABLE.includes(mimeType)) {
            const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
            if (!apiKey) return { status: 'error' };
            // ให้ AI อ่านไฟล์ = เรียก AI ทั้งไฟล์ จึงคิดเครดิต (.txt ไม่คิด)
            const paid = await consumeCredits(db, { audience, uid }, access.monthlyCredits, AI_CREDIT_COST.attachment, 'attachment', { mimeType });
            if (!paid.ok) return { status: 'insufficient-credits' };
            charge = paid.charge;
            credits = paid.status;
            const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.5-flash' });
            const data = Buffer.from(await file.arrayBuffer()).toString('base64');
            const res = await model.generateContent([
                { inlineData: { data, mimeType } },
                { text: 'ถอดข้อความทั้งหมดในเอกสารนี้ออกมาตามต้นฉบับทุกตัวอักษร คงเลขข้อ/ย่อหน้า ห้ามสรุป ห้ามแปล ห้ามเติมความเห็น ถ้าเป็นรูปที่ไม่มีข้อความให้บรรยายสั้น ๆ ว่าเป็นรูปอะไร' },
            ]);
            text = res.response.text();
        } else {
            return { status: 'unsupported' };
        }
        text = text.replace(/\r\n/g, '\n').trim();
        if (!text) {
            await refund();
            return { status: 'empty' };
        }
        const truncated = text.length > ATTACHMENT_MAX_CHARS;
        return { status: 'ok', attachment: { name, mimeType, text: text.slice(0, ATTACHMENT_MAX_CHARS), truncated }, credits };
    } catch (e) {
        console.error('[ai] readAttachment failed:', e instanceof Error ? e.message : e);
        await refund();
        return { status: 'error' };
    }
}
