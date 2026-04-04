import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { locales, localePrefix } from './navigation';
import { apiRateLimiter, authRateLimiter, getClientIp } from '@/lib/upstash-ratelimit';

// Initialize next-intl middleware for pages
const intlMiddleware = createMiddleware({
  locales,
  localePrefix,
  defaultLocale: 'th'
});

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Handle API Routes (Rate Limiting)
  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/booking')) {
      const ip = getClientIp(request);
      
      // Use stricter limit for auth routes
      const limiter = pathname.startsWith('/api/auth') ? authRateLimiter : apiRateLimiter;
      
      // We pass the raw IP format, Upstash handles the hashing
      try {
        const { success, limit, reset, remaining } = await limiter.limit(ip);

        if (!success) {
          return new NextResponse(
            JSON.stringify({ 
              error: 'Too many requests. Please try again later.',
              retryAfter: Math.ceil((reset - Date.now()) / 1000)
            }),
            { 
              status: 429, 
              headers: { 
                'Content-Type': 'application/json',
                'X-RateLimit-Limit': limit.toString(),
                'X-RateLimit-Remaining': remaining.toString(),
                'X-RateLimit-Reset': reset.toString(),
              } 
            }
          );
        }
      } catch (error) {
        // Fail open in development if Upstash keys are missing
        console.warn('[Middleware] Rate limiter failed (likely missing configuration). Failing open in development.');
      }
    }
    // IMPORTANT: Return next() for all API routes to bypass intlMiddleware
    return NextResponse.next();
  }

  // 2. Route Protection and Role-Based Access Control (RBAC)
  const segments = pathname.split('/').filter(Boolean);
  const isLocale = (locales as readonly string[]).includes(segments[0]);
  const currentLocale = isLocale ? segments[0] : 'th'; // Fallback to 'th' if no locale
  const route = isLocale ? `/${segments.slice(1).join('/')}` : pathname;

  const sessionHint = request.cookies.get('session_hint')?.value;
  const roleHint = request.cookies.get('role_hint')?.value || 'customer';
  const isAuthenticated = !!sessionHint;

  const loginUrl = new URL(`/${currentLocale}/login`, request.url);
  const clientDashboardUrl = new URL(`/${currentLocale}/dashboard`, request.url);
  const lawyerDashboardUrl = new URL(`/${currentLocale}/lawyer-dashboard`, request.url);

  // Define protected areas
  const clientProtectedPaths = ['/dashboard', '/payment', '/account'];
  const lawyerProtectedPaths = ['/lawyer-dashboard', '/lawyer-schedule'];
  const sharedProtectedPaths = ['/chat']; // Both roles can access chat

  const isClientProtected = clientProtectedPaths.some(p => route.startsWith(p) || route === p);
  const isLawyerProtected = lawyerProtectedPaths.some(p => route.startsWith(p) || route === p);
  const isSharedProtected = sharedProtectedPaths.some(p => route.startsWith(p) || route === p);

  // Unauthenticated users trying to hit protected routes bounce to /login
  if (!isAuthenticated && (isClientProtected || isLawyerProtected || isSharedProtected)) {
      return NextResponse.redirect(loginUrl);
  }

  // Authenticated RBAC Enforcements
  if (isAuthenticated) {
      if (roleHint === 'lawyer' && isClientProtected) {
          // Lawyer trying to access client dashboard bounces to lawyer dashboard
          return NextResponse.redirect(lawyerDashboardUrl);
      }
      
      if (roleHint !== 'lawyer' && isLawyerProtected) {
          // Client trying to access lawyer dashboard bounces to client dashboard
          return NextResponse.redirect(clientDashboardUrl);
      }
  }

  // 3. Handle Page Routes (Internationalization)
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Ignore statically requested files:
    // - _next/static, _next/image
    // - Specific media directories: pic, images, assets
    // - File extensions indicating static media (ignoring any path containing a dot before its end)
    '/((?!_next/static|_next/image|favicon.ico|icon.png|pic/|assets/|images/|js/|css/|.*\\..*).*)',
    // Always match API routes to enforce Edge rate limiting
    '/api/:path*'
  ],
};
