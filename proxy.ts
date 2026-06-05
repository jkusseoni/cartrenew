import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js Edge Runtime compatibility ke liye in-memory local tracking map use karenge
const ipCache = new Map<string, { count: number; resetTime: number }>();
const skipClerk =
  process.env.NODE_ENV === 'development' ||
  process.env.SKIP_CLERK === 'true' ||
  process.env.NEXT_PUBLIC_SKIP_CLERK === 'true';

// Simple rate limiter helper function IP requests limits track karne ke liye
function isRateLimited(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const userData = ipCache.get(ip);

  if (!userData) {
    ipCache.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (now > userData.resetTime) {
    // Window expire ho chuki hai, isliye reset karenge
    ipCache.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }

  userData.count += 1;
  return userData.count > limit;
}

function handleProxy(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  const { pathname } = request.nextUrl;

  // =======================================================
  // 1. IP-Based Rate Limiting (Sirf API routes ke liye)
  // =======================================================
  if (pathname.startsWith('/api')) {
    const LIMIT = 60; // Har IP ko 1 minute me max 60 requests allowed hain
    const WINDOW_MS = 60 * 1000; // 1 minute window (60000ms)

    const limitTriggered = isRateLimited(ip, LIMIT, WINDOW_MS);

    if (limitTriggered) {
      console.warn(`ðŸ›‘ [Rate Limiter] Blocked Request from IP: ${ip} on route: ${pathname}`);
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Too many requests, slow down bhai! Limit is 60 requests per minute.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      );
    }
  }

  // =======================================================
  // 2. Security Headers Injection (Global protection)
  // =======================================================
  const response = NextResponse.next();

  // A. Clickjacking Protection (Hume koi external site iframe me inject nahi kar payegi)
  response.headers.set('X-Frame-Options', 'DENY');

  // B. MIME Sniffing Protection (Browser ko force karega strictly defined content types render karne ke liye)
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // C. Referrer Policy (Redirects ke waqt data privacy control karne ke liye)
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // D. Strict Transport Security (HSTS - Production scale par sirf HTTPS forces ke liye)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  // E. Content Security Policy (CSP - Unauthorized script aur style injection se protection)
  // Humne isme Clerk, Facebook Pixel aur standard resources ko safely allow list me rakha hai
  const clerkSources = [
    'https://clerk.cartrenew.com',
    'https://*.clerk.accounts.dev',
    'https://*.clerk.com',
  ].join(' ');

  const cspHeader = [
    "default-src 'self';",
    `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com https://challenges.cloudflare.com ${clerkSources};`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
    "font-src 'self' https://fonts.gstatic.com data:;",
    `img-src 'self' data: https://images.unsplash.com https://img.clerk.com https://graph.facebook.com ${clerkSources};`,
    `connect-src 'self' https://generativelanguage.googleapis.com https://graph.facebook.com ${clerkSources};`,
    `frame-src 'self' https://challenges.cloudflare.com ${clerkSources};`,
  ].join(' ');

  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}

export default skipClerk
  ? handleProxy
  : clerkMiddleware((_auth, request: NextRequest) => handleProxy(request));

// Global matcher parameters Next.js execution cycle optimize karne ke liye
export const config = {
  matcher: [
    /*
     * Ye filters lagaye hain taaki static files (images, CSS, JS, favicons) par
     * à¤«à¤¾à¤²à¤¤à¥‚ me middleware execute na ho aur server fast chale.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
