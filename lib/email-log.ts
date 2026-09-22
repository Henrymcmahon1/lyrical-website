import type { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * `email_log`: one row per send, the idempotency check every hook consults before it mails
 * anyone, and the record support reads to see what a person actually received.
 *
 * Service role only (migration 004 enables RLS with no policies), so every function here takes
 * the admin client, the same convention as `lib/credits.ts`.
 *
 * These throw on a database error rather than returning a fallback value, on purpose: a failed
 * idempotency check that quietly returned "not sent yet" would double-mail somebody, and a
 * failed insert that was swallowed would mean the next check for the same job thinks nothing
 * was ever sent. The callers in `app/api/hooks/**` catch these, log, and still return 200 so
 * Supabase does not retry forever; failing loud here is what makes that catch meaningful.
 */

type Admin = ReturnType<typeof supabaseAdmin>

export type EmailSlug =
  | 'welcome'
  | 'plan-confirmed'
  | 'track-delivered'
  | 'reroll-delivered'
  | 'track-not-made'
  | 'eoi-received'
  | 'enquiry-received'
  | 'rating-reminder'

/**
 * Slugs that respect the per-account `product_emails` switch and the one-product-email-a-day
 * cap. Everything else in `EmailSlug` is transactional: it fires on an action the person just
 * took and cannot be turned off. `rating-reminder` is the only product email in v3's scope.
 */
export const PRODUCT_EMAIL_SLUGS: EmailSlug[] = ['rating-reminder']

const DAY_MS = 24 * 60 * 60 * 1000

/** Has this slug already gone to this user, optionally only within the last `sinceMs`? */
export async function alreadySent(
  admin: Admin,
  userId: string,
  slug: EmailSlug,
  sinceMs?: number,
): Promise<boolean> {
  let query = admin
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('slug', slug)
  if (sinceMs !== undefined) {
    query = query.gte('sent_at', new Date(Date.now() - sinceMs).toISOString())
  }
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

export type EmailLogRow = {
  userId: string | null
  toEmail: string
  slug: EmailSlug
  jobId?: string | null
  providerId?: string | null
}

export async function logSend(admin: Admin, row: EmailLogRow): Promise<void> {
  const { error } = await admin.from('email_log').insert({
    user_id: row.userId,
    to_email: row.toEmail,
    slug: row.slug,
    job_id: row.jobId ?? null,
    provider_id: row.providerId ?? null,
  })
  if (error) throw new Error(error.message)
}

/**
 * "Never more than one product email per person per day" (the emails README). Checked across
 * every slug in `PRODUCT_EMAIL_SLUGS`, not just the one about to send, so a second product email
 * introduced later shares the same daily cap rather than getting its own.
 */
export async function productEmailAllowedToday(admin: Admin, userId: string): Promise<boolean> {
  const { count, error } = await admin
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('slug', PRODUCT_EMAIL_SLUGS)
    .gte('sent_at', new Date(Date.now() - DAY_MS).toISOString())
  if (error) throw new Error(error.message)
  return (count ?? 0) === 0
}
