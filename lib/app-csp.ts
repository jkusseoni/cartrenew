const CARTRENEW_CLERK_SOURCES = [
  "https://clerk.cartrenew.com",
  "https://*.clerk.accounts.dev",
  "https://*.clerk.com",
];

/** Pingza's Clerk production frontend API and account portal hosts. */
const PINGZA_CLERK_SOURCES = ["https://clerk.pingza.app", "https://accounts.pingza.app"];

export function clerkCspSources(isDefaultBrand: boolean): string {
  const sources = isDefaultBrand
    ? CARTRENEW_CLERK_SOURCES
    : [...CARTRENEW_CLERK_SOURCES, ...PINGZA_CLERK_SOURCES];
  return sources.join(" ");
}

/** Production CSP for non-embedded pages and APIs. */
export function buildAppCsp(isDefaultBrand: boolean): string {
  const clerkSources = clerkCspSources(isDefaultBrand);
  return [
    "default-src 'self';",
    `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com https://challenges.cloudflare.com ${clerkSources};`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
    "font-src 'self' https://fonts.gstatic.com data:;",
    `img-src 'self' data: blob: https://images.unsplash.com https://img.clerk.com https://graph.facebook.com https://api.producthunt.com https://peerpush.com ${clerkSources};`,
    `connect-src 'self' https://generativelanguage.googleapis.com https://graph.facebook.com ${clerkSources};`,
    `frame-src 'self' https://challenges.cloudflare.com ${clerkSources};`,
    "worker-src 'self' blob:;",
    "child-src 'self' blob:;",
  ].join(" ");
}
