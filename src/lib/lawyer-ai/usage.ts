import 'server-only';

import type { UsageMetadata } from '@google/generative-ai';
import type { AiAudience } from '@/lib/lawyer-ai/types';

/**
 * บันทึกจำนวน token ต่อการเรียก AI หนึ่งครั้ง — ใช้ดูว่าต้นทุนจริงไปอยู่ที่โหมด/งานไหน ก่อนปรับเครดิตหรือรุ่นโมเดล
 * `aiUsageLogs/{id}` { audience, uid, kind, mode, model, promptTokens, cachedTokens, outputTokens, thoughtsTokens, totalTokens, at }
 * เก็บแค่ตัวเลข ห้ามเก็บข้อความคำถาม/คำตอบ/ไฟล์แนบ · เขียนผ่าน Admin SDK เท่านั้น (ไม่มี rules = client อ่าน/เขียนไม่ได้)
 */

type Db = FirebaseFirestore.Firestore;

export type AiUsageEntry = {
    audience: AiAudience;
    uid: string;
    kind: 'chat' | 'attachment';
    mode?: string;
    model: string;
};

/** 2.5-flash คิดเงิน token ที่ใช้ "คิด" เป็นขาออกด้วย — SDK รุ่นนี้ยังไม่มีฟิลด์นี้ใน type */
type UsageWithThoughts = UsageMetadata & { thoughtsTokenCount?: number };

export async function logAiUsage(db: Db, entry: AiUsageEntry, usage: UsageMetadata | undefined) {
    if (!usage) return;
    const u = usage as UsageWithThoughts;
    try {
        await db.collection('aiUsageLogs').add({
            ...entry,
            promptTokens: u.promptTokenCount ?? 0,
            cachedTokens: u.cachedContentTokenCount ?? 0,
            outputTokens: u.candidatesTokenCount ?? 0,
            thoughtsTokens: u.thoughtsTokenCount ?? 0,
            totalTokens: u.totalTokenCount ?? 0,
            at: Date.now(),
        });
    } catch (e) {
        // บันทึกไม่ได้ไม่ควรทำให้คำตอบของผู้ใช้ล้ม
        console.warn('[ai] usage log failed:', e instanceof Error ? e.message : e);
    }
}
