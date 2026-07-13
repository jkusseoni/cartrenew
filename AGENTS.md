<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

CartRenew is a Shopify abandoned-cart-recovery SaaS: a Next.js 16 (Turbopack) app plus a standalone marketing/merchant web app. The startup update script already runs `npm install` (which runs `prisma generate`) and `npx playwright install chromium`.

### Running
- Dev server: `npm run dev` (port 3000). Scripts live in `package.json`; prod build is `npm run build`, prod start is `npm start`.
- The app runs fully in dev **without any external services**. In `NODE_ENV=development`, Clerk auth is bypassed (a fake `local-dev` user is used) and Postgres/Supabase/Redis/Gemini/Twilio/Stripe/Shopify all degrade gracefully to mock/fallback data (e.g. `/api/analytics` returns `FALLBACK_ANALYTICS`, `/api/merchant/handshake` skips the DB). Console errors about a missing `DATABASE_URL` / Supabase are expected and non-fatal in dev.
- Middleware is in `proxy.ts` (this Next.js version's convention), not `middleware.ts`.

### Exercising real data paths (optional, needs secrets in `.env.local`, which is gitignored)
- `DATABASE_URL` (Postgres) — Prisma models (`User`, `Merchant`, `Cart`, `Order`); run `npm run db:migrate` to apply Prisma + Supabase SQL.
- The primary Shopify recovery pipeline (analytics, `/r/[cartId]` recovery links, `/api/webhooks/shopify`) uses the **Supabase REST client** (`lib/supabase.ts`), not Prisma — it needs `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (a real Supabase project, not just a local Postgres).
- AI recovery copy needs `GEMINI_API_KEY` + `GEMINI_MODEL` (no fallback — throws if unset). The BullMQ send path needs `REDIS_URL`. Real auth needs Clerk keys; WhatsApp send needs Twilio creds.

### Lint / test
- Lint: `npm run lint` (eslint). The repo has pre-existing lint errors/warnings unrelated to environment setup.
- E2E: `npm run test:e2e` (Playwright; `playwright.config.ts` auto-starts `npm run dev` and reuses a running one). Caveats: `tests/e2e/auth.spec.ts` requires Clerk keys; `tests/cart-recovery.spec.ts` asserts a landing hero badge ("Shopify Native Recovery System") that no longer exists in the current landing copy, so it fails against the current UI.
