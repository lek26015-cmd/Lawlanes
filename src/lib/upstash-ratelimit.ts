import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Upstash Redis-based distributed rate limiter
 * 
 * Persists across server restarts and works correctly in serverless
 * environments (Vercel, Cloudflare Workers, etc.)
 * 
 * Required env vars (ไม่ตั้ง = ปิด rate limit เงียบ ๆ):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

type LimitResult = { success: boolean; limit: number; remaining: number; reset: number };

// ไม่มี env = ปล่อยผ่าน (fail open) เหมือนตอน Redis ล่ม
const ALLOW: LimitResult = { success: true, limit: 0, remaining: 0, reset: 0 };

// สร้าง Redis ครั้งแรกที่ถูกเรียกจริง — ถ้าสร้างตอนโหลดไฟล์ (Redis.fromEnv())
// middleware จะพ่นคำเตือน env หายทุก request แม้หน้าที่ไม่ได้ rate limit
// undefined = ยังไม่ได้ลอง · null = ไม่ได้ตั้ง env (เงียบ ไม่ log)
let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    _redis = url && token ? new Redis({ url, token }) : null;
  }
  return _redis;
}

function lazyRatelimit(prefix: string, limiter: ReturnType<typeof Ratelimit.slidingWindow>) {
  let instance: Ratelimit | null | undefined;
  return {
    async limit(identifier: string): Promise<LimitResult> {
      if (instance === undefined) {
        const redis = getRedis();
        instance = redis ? new Ratelimit({ redis, limiter, prefix, analytics: true }) : null;
      }
      return instance ? instance.limit(identifier) : ALLOW;
    },
  };
}

export type LazyRatelimit = ReturnType<typeof lazyRatelimit>;

/**
 * Rate limiter for API routes (used in middleware)
 * 20 requests per 60 seconds using sliding window
 */
export const apiRateLimiter = lazyRatelimit('ratelimit:api', Ratelimit.slidingWindow(20, '60 s'));

/**
 * Rate limiter for public form submissions
 * 5 requests per 60 seconds (stricter, anti-spam)
 */
export const formRateLimiter = lazyRatelimit('ratelimit:form', Ratelimit.slidingWindow(5, '60 s'));

/**
 * Rate limiter for auth endpoints (login, signup, reset)
 * 10 requests per 60 seconds
 */
export const authRateLimiter = lazyRatelimit('ratelimit:auth', Ratelimit.slidingWindow(10, '60 s'));

/**
 * Extract the real client IP address from request headers.
 * Handles x-forwarded-for correctly for Vercel/proxy deployment.
 */
export function getClientIp(request: Request): string {
  // Vercel-specific header (most reliable on Vercel)
  const vercelIp = (request.headers as any).get?.('x-real-ip');
  if (vercelIp) return vercelIp;

  // Standard proxy header — take the first IP (original client)
  const forwarded = (request.headers as any).get?.('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  return 'anonymous';
}

/**
 * Check rate limit for a given identifier and limiter.
 * Returns { success, limit, remaining, reset } or throws on misconfiguration.
 */
export async function checkUpstashRateLimit(
  identifier: string,
  limiter: LazyRatelimit = formRateLimiter
): Promise<LimitResult> {
  try {
    const result = await limiter.limit(identifier);
    return result;
  } catch (error) {
    console.error('[Upstash RateLimit] Error:', error);
    // Fail open if Redis is unreachable — log for monitoring
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}
