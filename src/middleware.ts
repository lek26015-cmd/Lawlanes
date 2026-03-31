import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { locales, localePrefix } from './navigation';

// Initialize next-intl middleware for pages
const intlMiddleware = createMiddleware({
  locales,
  localePrefix,
  defaultLocale: 'th'
});

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const LIMIT = 20; // Increased limit slightly
const WINDOW = 60 * 1000;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Handle API Routes (Rate Limiting)
  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/booking')) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
      const now = Date.now();
      const rateData = rateLimitMap.get(ip) || { count: 0, lastReset: now };

      if (now - rateData.lastReset > WINDOW) {
        rateData.count = 0;
        rateData.lastReset = now;
      }

      rateData.count++;
      rateLimitMap.set(ip, rateData);

      if (rateData.count > LIMIT) {
        return new NextResponse(
          JSON.stringify({ error: 'Too many requests. Please try again later.' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    // IMPORTANT: Return next() for all API routes to bypass intlMiddleware
    return NextResponse.next();
  }

  // 2. Handle Page Routes (Internationalization)
  return intlMiddleware(request);
}

export const config = {
  // Standard next-intl matcher + our API routes
  matcher: [
    // Standard next-intl: Match all pathnames except for
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - icons (icon files)
    '/((?!_next/static|_next/image|favicon.ico|icon.png|pic/|assets/|.*\\..*).*)',
  ],
};
