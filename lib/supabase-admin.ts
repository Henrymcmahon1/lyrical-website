import { createClient } from '@supabase/supabase-js'
import type { Database } from './db/database.types'

/**
 * Server-only Supabase client using the service role key, which bypasses RLS.
 * NEVER import this into a client component — the key must not reach the browser.
 * Fails loudly when misconfigured rather than silently dropping enquiries.
 */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }
  return createClient<Database>(url, key, { auth: { persistSession: false } })
}
