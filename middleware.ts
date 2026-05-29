import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);
const publicRoutes = createRouteMatcher([
  "/api/webhooks/shopify",
  "/api/cron(.*)",
  "/api/alerts(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!publicRoutes(req) && isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};