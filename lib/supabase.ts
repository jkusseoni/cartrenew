import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

const SUPABASE_URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = normalizeEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY);

// Placeholders keep the module importable at build time, but a misconfigured
// runtime should be loud — every query would fail with confusing errors otherwise.
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing/invalid — ' +
      'server-side database queries will fail until env vars are configured.'
  );
}

const finalUrl = SUPABASE_URL || 'https://placeholder-project.supabase.co';
const finalKey = SUPABASE_SERVICE_ROLE_KEY || 'placeholder-fallback-secret-token-key';

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