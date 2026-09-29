'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { initAdmin } from '@/lib/firebase-admin';
import { checkLawyerFeature } from '@/lib/lawyer-plan-access';
import { limitUserAction } from '@/lib/security/action-rate-limit';
import { listCaseFolders } from '@/lib/lawyer-ai/case-context';
import {
    ATTACHMENT_MAX_BYTES,
    ATTACHMENT_MAX_CHARS,
    type AiAttachment,
    type AiCaseFolder,
    type AiMessage,
    type AiThreadSummary,
} from '@/lib/lawyer-ai/types';

/**
 * ผู้ช่วย AI งานคดี (Pro/บริษัท) — ดู lib/lawyer-ai/types.ts
 * การถาม-ตอบอยู่ที่ /api/lawyer-ai/chat (สตรีม) ไฟล์นี้คือรายการแฟ้มคดี/เธรด และการอ่านไฟล์แนบ
 */

type Locked = { status: 'unauthenticated' | 'not-lawyer' | 'upgrade-required' };

async function db() {
    const app = await initAdmin();
    if (!app) throw new Error('Firebase Admin not initialized');
    return app.firestore();
}

export async function getAiWorkspaceAction(): Promise<
    { status: 'ok'; cases: AiCaseFolder[]; threads: AiThreadSummary[] } | Locked
> {
    const access = await checkLawyerFeature('aiAssistant');
    if (access.status !== 'ok') return access;
    const firestore = await db();
    const [cases, threadSnap] = await Promise.all([
        listCaseFolders(firestore, access.uid),
        // ไม่ใช้ orderBy: where + orderBy ต้องสร้าง composite index บน Firebase production (ใช้ร่วมหลายเว็บ)
        // เรียงในหน่วยความจำแทน — ทนายหนึ่งคนมีเธรดไม่มาก
        firestore.collection('lawyerAiThreads').where('lawyerUid', '==', access.uid).limit(500).get(),
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
    return { status: 'ok', cases, threads };
}

export async function getAiThreadAction(threadId: string): Promise<
    { status: 'ok'; thread: AiThreadSummary; messages: AiMessage[] } | Locked | { status: 'not-found' }
> {
    const access = await checkLawyerFeature('aiAssistant');
    if (access.status !== 'ok') return access;
    const firestore = await db();
    const ref = firestore.collection('lawyerAiThreads').doc(String(threadId));
    const snap = await ref.get();
    if (!snap.exists || snap.get('lawyerUid') !== access.uid) return { status: 'not-found' };

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

export async function deleteAiThreadAction(threadId: string): Promise<{ status: 'ok' | 'not-found' } | Locked> {
    const access = await checkLawyerFeature('aiAssistant');
    if (access.status !== 'ok') return access;
    const firestore = await db();
    const ref = firestore.collection('lawyerAiThreads').doc(String(threadId));
    const snap = await ref.get();
    if (!snap.exists || snap.get('lawyerUid') !== access.uid) return { status: 'not-found' };
    await firestore.recursiveDelete(ref);
    return { status: 'ok' };
}

const GEMINI_READABLE = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

/**
 * อ่านข้อความจากไฟล์แนบ (PDF / รูป / .txt) — PDF และรูปให้ Gemini ถอดข้อความ (รองรับเอกสารสแกน)
 * ไม่เก็บตัวไฟล์ เก็บแค่ข้อความที่ถอดได้ไว้ใน message ตอนส่งคำถาม
 */
export async function readAttachmentAction(formData: FormData): Promise<
    { status: 'ok'; attachment: AiAttachment } | Locked | { status: 'rate-limited' | 'too-large' | 'unsupported' | 'empty' | 'error' }
> {
    const access = await checkLawyerFeature('aiAssistant');
    if (access.status !== 'ok') return access;
    if (!(await limitUserAction('ai-lawyer-attachment', access.uid, 30)).success) return { status: 'rate-limited' };

    const file = formData.get('file');
    if (!(file instanceof File)) return { status: 'unsupported' };
    if (file.size > ATTACHMENT_MAX_BYTES) return { status: 'too-large' };
    const name = file.name.slice(0, 200) || 'ไฟล์แนบ';
    const mimeType = file.type || '';

    try {
        let text = '';
        if (mimeType.startsWith('text/')) {
            text = await file.text();
        } else if (GEMINI_READABLE.includes(mimeType)) {
            const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
            if (!apiKey) return { status: 'error' };
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
        if (!text) return { status: 'empty' };
        const truncated = text.length > ATTACHMENT_MAX_CHARS;
        return { status: 'ok', attachment: { name, mimeType, text: text.slice(0, ATTACHMENT_MAX_CHARS), truncated } };
    } catch (e) {
        console.error('[lawyer-ai] readAttachment failed:', e instanceof Error ? e.message : e);
        return { status: 'error' };
    }
}
