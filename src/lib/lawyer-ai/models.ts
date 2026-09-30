/**
 * รุ่น Gemini ที่ลองตามลำดับ — gemini-2.5-flash ตอบ 503 "high demand" เป็นช่วง ๆ
 * จึงสลับไปรุ่นสำรองที่ใช้ใน rag.ts อยู่แล้ว (gemini-2.5-flash-lite ปิดให้โปรเจกต์ใหม่แล้ว — ห้ามใช้)
 */
export const AI_MODEL_ATTEMPTS = ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'] as const;

/** 503 / overloaded / quota ชั่วคราว — ควรลองรุ่นถัดไป */
export function isRetryableAiError(e: unknown): boolean {
    const msg = e instanceof Error ? e.message : String(e);
    return /\b(503|429|500|502|504)\b|overloaded|high demand|unavailable|not found|no longer available/i.test(msg);
}
