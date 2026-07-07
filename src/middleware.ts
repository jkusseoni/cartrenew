import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { locales, routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const localePublicRoutes = locales.flatMap((locale) => [
  `/${locale}`,
  `/${locale}/sign-in(.*)`,
  `/${locale}/sign-up(.*)`,
  `/${locale}/privacy(.*)`,
  `/${locale}/terms(.*)`,
  `/${locale}/refund(.*)`,
]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/refund(.*)",
  ...localePublicRoutes,
  "/api/webhook(.*)",
  "/api/webhooks(.*)",
]);

function getLocaleFromPath(pathname: string) {
  const segment = pathname.split("/")[1];
  return locales.includes(segment as (typeof locales)[number])
    ? segment
    : routing.defaultLocale;
}

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;

  // API routes must bypass next-intl — otherwise /api/* gets locale-prefixed and 404s.
  if (pathname.startsWith("/api")) {
    if (!isPublicRoute(req)) {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    return NextResponse.next();
  }

  if (isPublicRoute(req)) {
    return intlMiddleware(req);
  }

  const locale = getLocaleFromPath(pathname);
  const signInUrl = new URL(`/${locale}/sign-in`, req.url).toString();
  await auth.protect({ unauthenticatedUrl: signInUrl });

  return intlMiddleware(req);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html|css|js|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
