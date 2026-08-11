import { NextResponse } from 'next/server'
import { mailCustomer } from '@/lib/mailer'
import { supabaseServer } from '@/lib/supabase-server'
import { SITE_URL } from '@/lib/site'
import { welcomeHtml, welcomeSubject, welcomeText } from '@/lib/welcome-email'

/**
 * Where a magic link lands. Exchanges the one-time code for a session cookie.
 *
 * Two things here are security decisions rather than plumbing.
 *
 * **The redirect target is validated.** `next` comes from the URL, so without a check this is
 * a textbook open redirect: a link to our own domain that silently forwards to somebody
 * else's. It is worth more than usual here because the link arrives BY EMAIL and carries our
 * domain in front of it, which is exactly the shape a phishing link wants. Only a path on this
 * origin is accepted.
 *
 * **The origin comes from `SITE_URL`, not the request.** Behind a proxy the request host is
 * attacker-influenceable via forwarding headers, and this route hands out a session.
 */

/**
 * A safe `next`: same-origin, absolute path, and not `//host` which browsers read as a URL.
 *
 * Exported so it can be tested directly. Driving it through the route proves nothing, because
 * a request carrying a forged `next` also carries a forged code, so the exchange fails first
 * and the redirect that follows is the error path rather than this guard. A security control
 * that is only ever exercised by accident is a control nobody has checked.
 */
export function safePath(raw: string | null): string {
  if (!raw) return '/studio'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/studio'
  return raw
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safePath(url.searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(`${SITE_URL}/studio/sign-in?error=missing`)
  }

  const supabase = await supabaseServer()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Most often an expired or already-used link. The sign-in page says so in plain words
    // rather than showing the raw message, which tends to be about PKCE and helps nobody.
    return NextResponse.redirect(`${SITE_URL}/studio/sign-in?error=link`)
  }

  const user = data.user
  if (user && (await claimFirstSignIn(supabase, user.id))) {
    await mailCustomer(
      {
        to: user.email ?? '',
        subject: welcomeSubject(),
        text: welcomeText(),
        html: welcomeHtml(),
      },
      'welcome',
    )
  }

  return NextResponse.redirect(`${SITE_URL}${next}`)
}

/**
 * True exactly once per account, on the first magic link they ever open.
 *
 * Sign-in is passwordless, so "signed up" and "signed in" are the same click and there is no
 * separate signup event to hook. The profile row is used as the marker instead: inserting with
 * `ignoreDuplicates` returns the row only when it did not already exist, which makes "is this
 * their first time" a single atomic write rather than a read followed by a write. Two links
 * opened at the same moment therefore cannot both win, and nobody gets two welcomes.
 *
 * Written with the USER's client, not the admin one, so the `profiles_self_upsert` policy has
 * to pass as well. There is no reason for this path to hold service-role power.
 *
 * Never throws. A welcome email is worth strictly less than a working sign-in, so any failure
 * here is swallowed and the person still lands in the studio.
 */
async function claimFirstSignIn(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error('[auth] could not claim first sign-in', error)
      return false
    }
    return (data?.length ?? 0) > 0
  } catch (e) {
    console.error('[auth] profile claim threw', e)
    return false
  }
}
