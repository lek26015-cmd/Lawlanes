import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Upstash Redis-based distributed rate limiter
 * 
 * Persists across server restarts and works correctly in serverless
 * environments (Vercel, Cloudflare Workers, etc.)
 * 
 * Required env vars:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

// Lazy singleton — only created when first used
let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN. ' +
        'Set these in your .env.local file. ' +
        'Get them from https://console.upstash.com'
      );
    }

    _redis = new Redis({ url, token });
  }
  return _redis;
}

/**
 * Rate limiter for API routes (used in middleware)
 * 20 requests per 60 seconds using sliding window
 */
export const apiRateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '60 s'),
  prefix: 'ratelimit:api',
  analytics: true,
});

/**
 * Rate limiter for public form submissions
 * 5 requests per 60 seconds (stricter, anti-spam)
 */
export const formRateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  prefix: 'ratelimit:form',
  analytics: true,
});

/**
 * Rate limiter for auth endpoints (login, signup, reset)
 * 10 requests per 60 seconds
 */
export const authRateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  prefix: 'ratelimit:auth',
  analytics: true,
});

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
  limiter: Ratelimit = formRateLimiter
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  try {
    const result = await limiter.limit(identifier);
    return result;
  } catch (error) {
    console.error('[Upstash RateLimit] Error:', error);
    // Fail open if Redis is unreachable — log for monitoring
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}
