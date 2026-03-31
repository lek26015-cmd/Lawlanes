import { initializeFirebase } from '@/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { createHash } from 'crypto';

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
    const { firestore } = initializeFirebase();
    if (!firestore) return null;

    const cacheKey = generateCacheKey(input, namespace);
    const cacheRef = doc(firestore, 'ai_cache', cacheKey);
    const cacheSnap = await getDoc(cacheRef);

    if (cacheSnap.exists()) {
      const data = cacheSnap.data();
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
    const { firestore } = initializeFirebase();
    if (!firestore) return;

    const cacheKey = generateCacheKey(input, namespace);
    const cacheRef = doc(firestore, 'ai_cache', cacheKey);

    await setDoc(cacheRef, {
      result,
      createdAt: Timestamp.now(),
      input: input.substring(0, 500) // Store a snippet for debugging/reference
    });
    console.log(`[AI Cache] Saved for ${namespace} (${cacheKey})`);
  } catch (error) {
    console.warn(`[AI Cache] Error writing cache for ${namespace}:`, error);
  }
}
