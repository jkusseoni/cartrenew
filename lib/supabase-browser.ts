import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function normalizeEnvVar(value?: string): string {
  if (!value) return ''
  let trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function normalizeSupabaseUrl(value?: string): string {
  const url = normalizeEnvVar(value)
  if (!url) return ''
  try {
    new URL(url)
    return url
  } catch {
    return ''
  }
}

const SUPABASE_URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
const SUPABASE_ANON_KEY = normalizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

let cachedClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase browser env vars are missing or invalid')
  }

  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }

  return cachedClient
}
