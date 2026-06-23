import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { locales, routing } from "./i18n/routing";
import {
  isMerchantRole,
  MERCHANT_DASHBOARD_PATH,
  STANDARD_DASHBOARD_PATH,
} from "./lib/roles";

const intlMiddleware = createIntlMiddleware(routing);

const localePublicRoutes = locales.flatMap((locale) => [
  `/${locale}`,
  `/${locale}/sign-in(.*)`,
  `/${locale}/sign-up(.*)`,
  `/${locale}/terms(.*)`,
  `/${locale}/privacy(.*)`,
  `/${locale}/refund(.*)`,
  `/${locale}/marketing-hub(.*)`,
]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/terms(.*)",
  "/privacy(.*)",
  "/refund(.*)",
  "/marketing-hub(.*)",
  ...localePublicRoutes,
  "/__clerk/(.*)",
  "/api/merchant/handshake(.*)",
  "/api/webhooks(.*)",
  "/api/webhook(.*)",
  "/api/meta-capi(.*)",
  "/api/cart/automate(.*)",
  "/api/orders/webhook(.*)",
  "/api/shopify/callback(.*)",
  "/api/shopify/webhook(.*)",
  "/api/auth/shopify(.*)",
  "/api/cron(.*)",
  "/shopify(.*)",
  "/r/(.*)",
]);

// Standalone Shopify console: bypasses both next-intl locale routing and Clerk.
const isShopifyEntry = (pathname: string) =>
  pathname === "/shopify" || pathname.startsWith("/shopify/");

const isRecoveryRedirect = (pathname: string) =>
  pathname === "/r" || pathname.startsWith("/r/");

const SHOPIFY_SHOP_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

const isDev =
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "test";

const SHOPIFY_FRAME_ANCESTORS_FALLBACK =
  "frame-ancestors https://admin.shopify.com https://*.myshopify.com;";

/** Shopify requires a shop-specific frame-ancestors directive when embedded in Admin. */
function buildShopifyEmbedCsp(request: NextRequest): string {
  const shop = request.nextUrl.searchParams.get("shop");
  if (shop && SHOPIFY_SHOP_RE.test(shop)) {
    return `frame-ancestors https://${shop} https://admin.shopify.com;`;
  }
  return SHOPIFY_FRAME_ANCESTORS_FALLBACK;
}

/** Strip legacy framing blockers that override CSP frame-ancestors. */
function stripFramingHeaders(response: NextResponse) {
  response.headers.delete("X-Frame-Options");
  response.headers.delete("Content-Security-Policy");
  return response;
}

/** True when Shopify Admin is loading the app inside its iframe. */
function isShopifyEmbeddedRequest(request: NextRequest): boolean {
  const host = request.nextUrl.searchParams.get("host");
  return Boolean(host && host.length > 0);
}

/** Embedded apps land on `/` or `/shopify` with `?shop=&host=&hmac=`. */
function isShopifyLaunchRequest(request: NextRequest): boolean {
  const shop = request.nextUrl.searchParams.get("shop");
  const hasShop = Boolean(shop && SHOPIFY_SHOP_RE.test(shop));
  return hasShop || isShopifyEmbeddedRequest(request);
}

function shouldBypassAuthForShopify(request: NextRequest): boolean {
  return isShopifyEntry(request.nextUrl.pathname) || isShopifyLaunchRequest(request);
}

const isAuthRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  ...locales.flatMap((locale) => [
    `/${locale}/sign-in(.*)`,
    `/${locale}/sign-up(.*)`,
  ]),
]);

const isMerchantRoute = createRouteMatcher(["/merchant(.*)"]);

const isStandardAppRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/analytics(.*)",
  "/settings(.*)",
  "/admin(.*)",
  ...locales.flatMap((locale) => [
    `/${locale}/dashboard(.*)`,
    `/${locale}/analytics(.*)`,
    `/${locale}/settings(.*)`,
    `/${locale}/admin(.*)`,
  ]),
]);

const ipCache = new Map<string, { count: number; resetTime: number }>();
const skipClerk =
  process.env.NODE_ENV === "development" ||
  process.env.SKIP_CLERK === "true" ||
  process.env.NEXT_PUBLIC_SKIP_CLERK === "true";

function getLocaleFromPath(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean)[0];
  return locales.includes(segment as (typeof locales)[number])
    ? segment
    : routing.defaultLocale;
}

function localizedPath(locale: string, path: string): string {
  // localePrefix is 'always': prefix every locale (including the default).
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `/${locale}/${normalized}`;
}

function isRateLimited(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const userData = ipCache.get(ip);

  if (!userData || now > userData.resetTime) {
    ipCache.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }

  userData.count += 1;
  return userData.count > limit;
}

function applySecurityHeaders(response: NextResponse) {
  if (isDev) {
    stripFramingHeaders(response);
  } else {
    response.headers.set("X-Frame-Options", "DENY");
  }
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  if (!isDev) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

    const clerkSources = [
      "https://clerk.cartrenew.com",
      "https://*.clerk.accounts.dev",
      "https://*.clerk.com",
    ].join(" ");

    const cspHeader = [
      "default-src 'self';",
      `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com https://challenges.cloudflare.com ${clerkSources};`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
      "font-src 'self' https://fonts.gstatic.com data:;",
      `img-src 'self' data: blob: https://images.unsplash.com https://img.clerk.com https://graph.facebook.com ${clerkSources};`,
      `connect-src 'self' https://generativelanguage.googleapis.com https://graph.facebook.com ${clerkSources};`,
      `frame-src 'self' https://challenges.cloudflare.com ${clerkSources};`,
      "worker-src 'self' blob:;",
      "child-src 'self' blob:;",
    ].join(" ");

    response.headers.set("Content-Security-Policy", cspHeader);
  }

  return response;
}

/**
 * Headers for the embedded Shopify console.
 * Dev: strip framing/CSP so Admin iframe + local tab both work.
 * Prod: shop-scoped frame-ancestors — never X-Frame-Options.
 */
function applyShopifyEmbedHeaders(response: NextResponse, request: NextRequest) {
  stripFramingHeaders(response);

  if (isDev) {
    return response;
  }

  response.headers.set("Content-Security-Policy", buildShopifyEmbedCsp(request));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

  return response;
}

/** Bypass locale/Clerk and apply embed-friendly headers for Shopify routes. */
function handleShopifyRequest(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (isShopifyEntry(pathname)) {
    return applyShopifyEmbedHeaders(NextResponse.next(), request);
  }

  if (pathname === "/" && isShopifyLaunchRequest(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/shopify";
    return applyShopifyEmbedHeaders(NextResponse.redirect(url), request);
  }

  return null;
}

/** Customer recovery links must bypass locale prefixing and auth. */
function handleRecoveryRedirectRequest(request: NextRequest): NextResponse | null {
  if (isRecoveryRedirect(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return null;
}

function handleApiRequest(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.1";
  const limitTriggered = isRateLimited(ip, 60, 60 * 1000);

  if (limitTriggered) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: "Too many requests, slow down bhai! Limit is 60 requests per minute.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      }
    );
  }

  return NextResponse.next();
}

function runIntlMiddleware(request: NextRequest) {
  return intlMiddleware(request);
}

function isIntlRedirect(response: NextResponse) {
  const location = response.headers.get("location");
  return Boolean(location && response.status >= 300 && response.status < 400);
}

/** Clerk path routing can leak nested URLs like /sign-in/dashboard — rewrite to real routes. */
function resolveClerkPathLeak(pathname: string): string | null {
  for (const locale of locales) {
    const prefix = `/${locale}/sign-in/`;
    if (pathname.startsWith(prefix)) {
      const rest = pathname.slice(prefix.length);
      if (rest === "sign-in") return `/${locale}/sign-in`;
      if (rest === "sign-up") return `/${locale}/sign-up`;
      if (rest.startsWith("dashboard")) return `/${locale}/${rest}`;
    }

    const signUpPrefix = `/${locale}/sign-up/`;
    if (pathname.startsWith(signUpPrefix)) {
      const rest = pathname.slice(signUpPrefix.length);
      if (rest === "sign-in") return `/${locale}/sign-in`;
      if (rest === "sign-up") return `/${locale}/sign-up`;
      if (rest.startsWith("dashboard")) return `/${locale}/${rest}`;
    }
  }

  if (pathname.startsWith("/sign-in/")) {
    const rest = pathname.slice("/sign-in/".length);
    if (rest === "sign-in") return "/sign-in";
    if (rest === "sign-up") return "/sign-up";
    if (rest.startsWith("dashboard")) return `/${rest}`;
  }

  if (pathname.startsWith("/sign-up/")) {
    const rest = pathname.slice("/sign-up/".length);
    if (rest === "sign-in") return "/sign-in";
    if (rest === "sign-up") return "/sign-up";
    if (rest.startsWith("dashboard")) return `/${rest}`;
  }

  return null;
}

function resolveRoleBasedRedirect(
  request: NextRequest,
  sessionClaims: CustomJwtSessionClaims | null | undefined,
  userId: string | null | undefined
) {
  const merchant = isMerchantRole(sessionClaims);
  const locale = getLocaleFromPath(request.nextUrl.pathname);

  if (isMerchantRoute(request)) {
    if (!merchant) {
      if (userId) {
        return NextResponse.redirect(
          new URL(localizedPath(locale, STANDARD_DASHBOARD_PATH), request.url)
        );
      }

      return null;
    }

    return null;
  }

  if (merchant && (isStandardAppRoute(request) || isAuthRoute(request))) {
    return NextResponse.redirect(new URL(MERCHANT_DASHBOARD_PATH, request.url));
  }

  return null;
}

async function handlePageRequest(request: NextRequest) {
  const intlResponse = runIntlMiddleware(request);

  if (isIntlRedirect(intlResponse)) {
    return applySecurityHeaders(intlResponse);
  }

  return applySecurityHeaders(intlResponse);
}

export default skipClerk
  ? async (request: NextRequest) => {
      if (request.nextUrl.pathname.startsWith("/api")) {
        return applySecurityHeaders(handleApiRequest(request));
      }

      const shopifyResponse = handleShopifyRequest(request);
      if (shopifyResponse) return shopifyResponse;

      const recoveryResponse = handleRecoveryRedirectRequest(request);
      if (recoveryResponse) return recoveryResponse;

      const leakedPath = resolveClerkPathLeak(request.nextUrl.pathname);
      if (leakedPath) {
        return applySecurityHeaders(
          NextResponse.redirect(new URL(leakedPath, request.url))
        );
      }

      return handlePageRequest(request);
    }
  : clerkMiddleware(async (auth, request: NextRequest) => {
      if (request.nextUrl.pathname.startsWith("/api")) {
        return applySecurityHeaders(handleApiRequest(request));
      }

      const shopifyResponse = handleShopifyRequest(request);
      if (shopifyResponse) return shopifyResponse;

      const recoveryResponse = handleRecoveryRedirectRequest(request);
      if (recoveryResponse) return recoveryResponse;

      const leakedPath = resolveClerkPathLeak(request.nextUrl.pathname);
      if (leakedPath) {
        return applySecurityHeaders(
          NextResponse.redirect(new URL(leakedPath, request.url))
        );
      }

      const intlResponse = runIntlMiddleware(request);

      if (isIntlRedirect(intlResponse)) {
        return applySecurityHeaders(intlResponse);
      }

      // Never run Clerk session gates on Shopify embed launches — they break
      // App Bridge session tokens inside the Admin iframe.
      if (shouldBypassAuthForShopify(request)) {
        return applyShopifyEmbedHeaders(intlResponse, request);
      }

      const { sessionClaims, userId } = await auth();
      const roleRedirect = resolveRoleBasedRedirect(request, sessionClaims, userId);

      if (roleRedirect) {
        return applySecurityHeaders(roleRedirect);
      }

      if (!isPublicRoute(request)) {
        const locale = getLocaleFromPath(request.nextUrl.pathname);
        const signInUrl = localizedPath(locale, "/sign-in");
        await auth.protect({ unauthenticatedUrl: signInUrl });
      }

      return applySecurityHeaders(intlResponse);
    });

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
