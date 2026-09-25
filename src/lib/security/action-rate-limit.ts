import 'server-only';
import { headers } from 'next/headers';
import { checkUpstashRateLimit, apiRateLimiter } from '@/lib/upstash-ratelimit';
import { checkRateLimit } from '@/lib/security/rate-limiter';

/**
 * rate limit สำหรับ server action ที่เรียก LLM / บริการที่คิดเงินต่อครั้ง
 *
 * middleware.ts จำกัดความถี่เฉพาะ /api/* — server action ยิงเป็น POST เข้า path ของหน้า
 * จึงไม่ผ่านด่านนั้นเลย action พวกนี้ต้องกันเอง
 */

async function getActionIp() {
  const h = await headers();
  const real = h.get('x-real-ip');
  if (real) return real;
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim() || 'anonymous';
  return 'anonymous';
}

/** action สาธารณะ (ไม่ต้องล็อกอิน) — จำกัดต่อ IP ผ่าน Upstash (20 ครั้ง/นาที) */
export async function limitPublicAction(name: string) {
  const ip = await getActionIp();
  return checkUpstashRateLimit(`${name}:${ip}`, apiRateLimiter);
}

/** action ที่ล็อกอินแล้ว — จำกัดต่อบัญชี (ค่าเริ่มต้น 30 ครั้ง / 10 นาที) */
export async function limitUserAction(name: string, uid: string, limit = 30, windowMs = 10 * 60 * 1000) {
  return checkRateLimit(`${name}:${uid}`, limit, windowMs);
}
