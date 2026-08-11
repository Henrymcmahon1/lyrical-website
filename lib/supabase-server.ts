import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * The server client, also running as the signed in user, reading the session from cookies.
 *
 * Use this anywhere the server needs to know WHO is asking. It respects RLS, so a query
 * written here returns the caller's own rows and nothing else, even if the query itself is
 * careless. That is the point: `lib/supabase-admin.ts` bypasses every policy and is reserved
 * for staff paths like `/queue` and the enquiry route.
 *
 * `cookies()` is async-only in Next.js 16, hence the await.
 *
 * The `setAll` catch is not laziness. Server Components are not allowed to write cookies, and
 * Supabase calls it during token refresh. Swallowing it there is the documented pattern and is
 * safe because the middleware and the callback route, both of which CAN write, keep the
 * session fresh. Without the catch, every page render that happens to land on a refresh throws.
 */
export async function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set')
  }

  const jar = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options)
        } catch {
          // Called from a Server Component, which cannot write cookies. See above.
        }
      },
    },
  })
}

/**
 * The signed in user, or null.
 *
 * Deliberately `getUser()` and not `getSession()`. `getSession()` reads the cookie and trusts
 * it; `getUser()` verifies the token against Supabase. On a page that decides whether somebody
 * may see other people's masters, "the cookie says so" is not good enough.
 */
export async function currentUser() {
  const { data, error } = await (await supabaseServer()).auth.getUser()
  if (error) return null
  return data.user ?? null
}
