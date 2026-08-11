import { createBrowserClient } from '@supabase/ssr'

/**
 * The browser client, running as the SIGNED IN USER.
 *
 * This is a different animal from `lib/supabase-admin.ts` and the difference is the whole
 * security model of the portal. The admin client holds the service role key, bypasses every
 * RLS policy, and must never reach the browser. This one holds the anon key, which is designed
 * to be public, and can therefore only ever see what the policies in `supabase/schema.sql`
 * allow the current user to see.
 *
 * It exists because uploads cannot go through the server. A WAV is 40 to 70MB and Vercel caps
 * a request body at 4.5MB, so the file goes from this client straight to storage, and the
 * storage policies are what stop a customer writing into somebody else's folder.
 *
 * Fails loudly rather than returning a client that will 401 on every call for reasons nobody
 * can see from the error.
 */
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. ' +
        'Use the ANON key, never the service role key: anything with a NEXT_PUBLIC_ prefix ' +
        'is inlined into the client bundle.',
    )
  }
  return createBrowserClient(url, key)
}
