import { initAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { createHash } from 'crypto';

/**
 * แคชคำตอบ AI เก็บผ่าน Admin SDK เท่านั้น
 *
 * เดิมใช้ client SDK (ไม่ได้ล็อกอิน) คู่กับ rule `ai_cache: allow read, write: if true`
 * → ใครก็เขียนทับคำตอบในแคชได้ (key คือ sha256 ของ input ซึ่งคำนวณเองได้) ทำให้ผู้ใช้คนถัดไป
 *   ที่ถามคำถามเดียวกันได้ "คำตอบกฎหมาย" ที่คนอื่นแต่งไว้
 * → ใครก็อ่านได้ และเอกสารเก็บ `input` 500 ตัวอักษรแรกไว้ด้วย (เช่น เนื้อหาสัญญาที่ผู้ใช้ส่งมาวิเคราะห์)
 * ตอนนี้ rule ปิดสนิท และฟังก์ชันพวกนี้ถูกเรียกจาก server action / AI flow เท่านั้น
 */
async function getAdminDb() {
  const adminApp = await initAdmin();
  return adminApp ? adminApp.firestore() : null;
}

/**
 * Generates a stable hash for a given prompt/input to use as a cache key.
 */
function generateCacheKey(input: string, namespace: string): string {
  const hash = createHash('sha256').update(input).digest('hex');
  return `${namespace}_${hash}`;
}

/**
 * Attempts to retrieve a cached AI response from Firestore.
 * @param input The input string (prompt or content)
 * @param namespace A prefix to avoid collisions between different AI features
 * @param ttlSeconds Time-to-live in seconds (default: 7 days)
 */
export async function getCachedAIResponse<T>(
  input: string,
  namespace: string,
  ttlSeconds: number = 60 * 60 * 24 * 7
): Promise<T | null> {
  try {
    const db = await getAdminDb();
    if (!db) return null;

    const cacheKey = generateCacheKey(input, namespace);
    const cacheSnap = await db.collection('ai_cache').doc(cacheKey).get();

    if (cacheSnap.exists) {
      const data = cacheSnap.data()!;
      const createdAt = data.createdAt as Timestamp;
      const now = Timestamp.now();

      // Check if cache is still valid
      if (now.seconds - createdAt.seconds < ttlSeconds) {
        console.log(`[AI Cache] Hit for ${namespace} (${cacheKey})`);
        return data.result as T;
      }
      console.log(`[AI Cache] Expired for ${namespace}`);
    }
  } catch (error) {
    console.warn(`[AI Cache] Error reading cache for ${namespace}:`, error);
  }
  return null;
}

/**
 * Saves an AI response to the Firestore cache.
 */
export async function setCachedAIResponse<T>(
  input: string,
  namespace: string,
  result: T
): Promise<void> {
  try {
    const db = await getAdminDb();
    if (!db) return;

    const cacheKey = generateCacheKey(input, namespace);

    await db.collection('ai_cache').doc(cacheKey).set({
      result,
      createdAt: Timestamp.now(),
      input: input.substring(0, 500) // Store a snippet for debugging/reference
    });
    console.log(`[AI Cache] Saved for ${namespace} (${cacheKey})`);
  } catch (error) {
    console.warn(`[AI Cache] Error writing cache for ${namespace}:`, error);
  }
}
