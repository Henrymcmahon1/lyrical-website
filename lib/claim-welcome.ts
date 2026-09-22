import { mailCustomer } from './mailer'
import { welcomeHtml, welcomeSubject, welcomeText } from './welcome-email'

/**
 * The ONE rule for "is this somebody's first sign-in", shared by the code sign-in path, the
 * Google path, and the old magic-link path they replace (`app/(public)/studio/sign-in/actions.ts`
 * and `app/auth/callback/route.ts`).
 *
 * Keyed off `profiles.welcomed_at is null`, not "does the profiles row exist". The old trick
 * (`upsert({id}, {ignoreDuplicates:true})`, welcome on the row actually inserted) only worked
 * because the row's EXISTENCE was the first-sign-in signal, and that stops being true the moment
 * any code path is allowed to create a profile row before a welcome has gone out. Sign-in now has
 * two doors in (code, Google) plus the surviving magic-link one, and all three must agree on the
 * same account without racing each other or double-sending.
 *
 * The claim is a single conditional UPDATE (`... WHERE id = ? AND welcomed_at IS NULL`), which
 * Postgres runs atomically: two sign-ins landing at the same instant can only ever have one of
 * them come back with a row. Run with the CALLER's client (the signed-in user's own, respecting
 * RLS's `profiles_self_update`), never the admin one, for the same reason the original code did:
 * there is no reason this path needs service-role power.
 *
 * Never throws. A welcome email is worth strictly less than a working sign-in.
 */

type SupabaseLike = {
  from: (table: string) => {
    upsert: (
      row: Record<string, unknown>,
      opts: { onConflict: string; ignoreDuplicates: boolean },
    ) => PromiseLike<{ error: unknown }>
    update: (row: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string,
      ) => {
        is: (
          column: string,
          value: null,
        ) => {
          select: (columns: string) => PromiseLike<{ data: unknown[] | null; error: unknown }>
        }
      }
    }
  }
}

export async function claimWelcomeOnce(
  supabase: SupabaseLike,
  userId: string,
  userEmail: string | null,
): Promise<boolean> {
  try {
    // Make sure the row exists, without disturbing welcomed_at if it already does. A no-op when
    // it does; harmless if this races the caller's own upsert elsewhere.
    await supabase.from('profiles').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })

    const { data, error } = await supabase
      .from('profiles')
      .update({ welcomed_at: new Date().toISOString() })
      .eq('id', userId)
      .is('welcomed_at', null)
      .select('id')

    if (error) {
      console.error('[auth] could not claim the welcome email', error)
      return false
    }

    const claimed = (data?.length ?? 0) > 0
    if (claimed && userEmail) {
      await mailCustomer(
        { to: userEmail, subject: welcomeSubject(), text: welcomeText(), html: welcomeHtml() },
        'welcome',
      )
    }
    return claimed
  } catch (e) {
    console.error('[auth] welcome claim threw', e)
    return false
  }
}
