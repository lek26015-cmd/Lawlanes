/**
 * ผู้ช่วย AI งานคดีของทนาย (Pro/บริษัท) — type ที่ใช้ได้ทั้ง client และ server
 *
 * ข้อมูลเก็บที่ `lawyerAiThreads/{threadId}` + `messages/{messageId}` อ่าน/เขียนผ่าน Admin SDK เท่านั้น
 * (ไม่มี rules เปิดให้ client → ตก default deny) · เธรดผูกกับคดีใน legalCases ได้ (caseId) หรือไม่ผูกก็ได้
 */

export type AiMode = 'ask' | 'statute' | 'judgment' | 'draft' | 'contract';

export const AI_MODES: { id: Exclude<AiMode, 'ask'>; label: string; hint: string }[] = [
    { id: 'statute', label: 'มาตรา', hint: 'หาตัวบทและมาตราที่เกี่ยวข้อง พร้อมอธิบาย' },
    { id: 'judgment', label: 'ฎีกา', hint: 'หาคำพิพากษาฎีกาที่เทียบเคียงได้' },
    { id: 'draft', label: 'ร่างเอกสาร', hint: 'ร่างหนังสือบอกกล่าว คำฟ้อง สัญญา ฯลฯ' },
    { id: 'contract', label: 'ตรวจสัญญา', hint: 'ชี้จุดเสี่ยงในสัญญาที่แนบหรือวางมา' },
];

export type SourceType = 'statute' | 'judgment' | 'gazette' | 'other';

/** ตัวบท/ฎีกาที่ AI ใช้อ้างอิง — n คือเลขใน [1] [2] ของคำตอบ */
export type AiCitation = {
    n: number;
    title: string;
    type: SourceType;
    year?: number;
    content: string;
};

export type AiAttachment = {
    name: string;
    mimeType: string;
    /** ข้อความที่อ่านได้จากไฟล์ (ตัดให้ไม่เกิน ATTACHMENT_MAX_CHARS) */
    text: string;
    truncated?: boolean;
};

export type AiMessage = {
    id: string;
    role: 'user' | 'model';
    content: string;
    mode: AiMode;
    citations?: AiCitation[];
    /** เก็บแค่ชื่อไฟล์ไว้แสดง — ข้อความเต็มอยู่ใน doc ของ message ฝั่ง server */
    attachments?: { name: string; mimeType: string }[];
    createdAt: number;
};

export type AiThreadSummary = {
    id: string;
    title: string;
    caseId: string | null;
    updatedAt: number;
};

export type AiCaseFolder = {
    id: string;
    title: string;
    clientName: string;
    status: string;
};

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_MAX_CHARS = 60_000;
export const ATTACHMENT_ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp,text/plain';
export const MESSAGE_MAX_CHARS = 8_000;

/** สตรีมจาก /api/lawyer-ai/chat — หนึ่งบรรทัดต่อหนึ่ง event (NDJSON) */
export type AiStreamEvent =
    | { type: 'thread'; threadId: string; title: string }
    | { type: 'citations'; citations: AiCitation[] }
    | { type: 'delta'; text: string }
    | { type: 'done'; messageId: string }
    | { type: 'error'; code: 'unauthenticated' | 'not-lawyer' | 'upgrade-required' | 'rate-limited' | 'quota' | 'bad-request' | 'error'; message?: string };
