import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { appendFileSync } from 'node:fs';

import { brand } from '@/lib/brand';
import { assertPingzaPreviewNotOnProductionSupabase } from '@/lib/supabase-env-guard';

// 🎯 Helper 1: Cleans trailing spaces and accidental quotes from environment variables
function normalizeEnvVar(value?: string): string {
  if (!value) return '';
  return value.replace(/['"]/g, '').trim();
}

// 🎯 Helper 2: Validates the URL structure safely for compile-time
function normalizeSupabaseUrl(value?: string): string {
  const url = normalizeEnvVar(value);
  if (!url) return '';
  try {
    new URL(url);
    return url;
  } catch {
    return '';
  }
}

/**
 * Derive https://<project-ref>.supabase.co from DATABASE_URL when the dedicated
 * NEXT_PUBLIC_SUPABASE_URL var is missing (common local-dev gap).
 */
function deriveSupabaseUrlFromDatabaseUrl(databaseUrl?: string): string {
  const raw = normalizeEnvVar(databaseUrl);
  if (!raw) return '';

  try {
    const parsed = new URL(raw.replace(/^postgresql:/i, 'http:'));
    const userRef = parsed.username.match(/^postgres\.([a-z0-9]+)$/i)?.[1];
    if (userRef) {
      return `https://${userRef}.supabase.co`;
    }

    const hostRef = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)?.[1];
    if (hostRef) {
      return `https://${hostRef}.supabase.co`;
    }
  } catch {
    return '';
  }

  return '';
}

let SUPABASE_URL =
  normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  deriveSupabaseUrlFromDatabaseUrl(process.env.DATABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = normalizeEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY);

// Pingza Preview/staging must not use the production Supabase project (PCD).
// #region agent log
if (process.env.CURSOR_DEBUG_SUPABASE_GUARD === '1') appendFileSync('/opt/cursor/logs/debug.log', JSON.stringify({ hypothesisId: 'B,C,D', location: 'lib/supabase.ts:57', message: 'before preview guard', data: { brandIsDefault: brand.isDefault, vercelEnv: ['production', 'preview', 'development'].includes((process.env.VERCEL_ENV ?? '').trim().toLowerCase()) ? (process.env.VERCEL_ENV ?? '').trim().toLowerCase() : 'other', nextPublicUrlPresent: Boolean(normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)), databaseUrlPresent: Boolean(normalizeEnvVar(process.env.DATABASE_URL)), configuredUrlPresent: Boolean(SUPABASE_URL), serviceKeyPresent: Boolean(SUPABASE_SERVICE_ROLE_KEY) }, timestamp: Date.now() }) + '\n');
// #endregion
const previewGuard = assertPingzaPreviewNotOnProductionSupabase({
  isDefaultBrand: brand.isDefault,
  vercelEnv: process.env.VERCEL_ENV,
  configuredUrl: SUPABASE_URL,
  productionUrl: process.env.PINGZA_PRODUCTION_SUPABASE_URL,
});
// #region agent log
if (process.env.CURSOR_DEBUG_SUPABASE_GUARD === '1') appendFileSync('/opt/cursor/logs/debug.log', JSON.stringify({ hypothesisId: 'A,B', location: 'lib/supabase.ts:68', message: 'after preview guard', data: { ok: previewGuard.ok, skipped: 'skipped' in previewGuard ? previewGuard.skipped : null }, timestamp: Date.now() }) + '\n');
// #endregion
if (!previewGuard.ok) {
  console.error('[supabase]', previewGuard.reason);
  // Fail closed: do not attach the production client on Preview.
  SUPABASE_URL = '';
}
// #region agent log
if (process.env.CURSOR_DEBUG_SUPABASE_GUARD === '1') appendFileSync('/opt/cursor/logs/debug.log', JSON.stringify({ hypothesisId: 'B', location: 'lib/supabase.ts:77', message: 'after guard mutation', data: { guardBlocked: !previewGuard.ok, configuredAfterGuard: Boolean(SUPABASE_URL), usingPlaceholder: !SUPABASE_URL }, timestamp: Date.now() }) + '\n');
// #endregion

// Placeholders keep the module importable at build time, but a misconfigured
// runtime should be loud — every query would fail with confusing errors otherwise.
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing/invalid — ' +
      'server-side database queries will fail until env vars are configured.'
  );
}

const finalUrl = SUPABASE_URL || 'https://placeholder-project.supabase.co';
// JWTs must not contain whitespace (common when a key is pasted into Vercel with a newline).
const finalKey = (SUPABASE_SERVICE_ROLE_KEY || 'placeholder-fallback-secret-token-key').replace(
  /\s+/g,
  ''
);

/** False when queries would hit the placeholder client and fail confusingly. */
export function isSupabaseAdminConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

// 🟢 1. Direct Export Instance: Yeh aapke saare webhooks aur admin files ke imports ko instant fix kar dega
export const supabaseAdmin = createClient(finalUrl, finalKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// 🟢 2. Function Variant Export: Complete backward compatibility ke liye ise bhi maintain rakha hai
export function getSupabaseAdmin(): SupabaseClient {
  return supabaseAdmin;
}