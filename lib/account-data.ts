import type { TablesUpdate } from '@/lib/db/database.types'
import type { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * The account page's own I/O: reading and writing rows that belong to a Bot 1 (auth + emails)
 * migration this bot does not own, and gathering an export or retiring an account across
 * several tables. Every function here takes the service-role client and the CALLER'S user id,
 * and every query is scoped to that id; the page proves the session first with `currentUser()`.
 *
 * ## Defensive against migration 004 not being merged yet
 *
 * `profiles.product_emails`, `profiles.rating_reminders` and `profiles.retired_at` belong to
 * Bot 1's migration 004. Until it lands the columns do not exist, and PostgREST refuses the
 * WHOLE query rather than returning null for an unknown column, so this cannot be a plain
 * `?? true` on the result. `isMissingColumn` narrows to exactly that one failure shape; any
 * other error still throws or fails the call, the same as an unguarded query would. This is a
 * deliberate, narrow exception to "fail loud", not a general silent fallback: it exists because
 * a sibling bot's migration is the known, temporary reason the column can be absent.
 */
type Admin = ReturnType<typeof supabaseAdmin>

/**
 * What the customer must type on /studio/account before the delete button does anything.
 * Lives here, not in `app/studio/account/actions.ts`, because a `'use server'` module may only
 * export async functions: a plain string export there breaks the build (Next.js: "the module
 * has no exports at all" once a non-function value is exported alongside the actions).
 */
export const DELETE_CONFIRM_TEXT = 'DELETE'

function isMissingColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === '42703' || error.code === 'PGRST204') return true
  return /column .* does not exist/i.test(error.message ?? '')
}

export type EmailPreferences = {
  productEmails: boolean
  ratingReminders: boolean
  /** False when migration 004 has not landed: the toggles shown are defaults, not a real read. */
  available: boolean
}

/** Both product-email toggles. Transactional mail (delivery, welcome) is never gated by these. */
export async function getEmailPreferences(admin: Admin, userId: string): Promise<EmailPreferences> {
  const { data, error } = await admin
    .from('profiles')
    .select('product_emails, rating_reminders')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    if (isMissingColumn(error)) return { productEmails: true, ratingReminders: true, available: false }
    throw new Error(error.message)
  }
  return {
    productEmails: data?.product_emails ?? true,
    ratingReminders: data?.rating_reminders ?? true,
    available: true,
  }
}

export type SetEmailPreferenceResult = { ok: true } | { ok: false; error: string }

/** Saves whichever toggles are given. A no-op empty patch succeeds without writing. */
export async function setEmailPreference(
  admin: Admin,
  userId: string,
  patch: Partial<{ productEmails: boolean; ratingReminders: boolean }>,
): Promise<SetEmailPreferenceResult> {
  const row: TablesUpdate<'profiles'> = {}
  if (patch.productEmails !== undefined) row.product_emails = patch.productEmails
  if (patch.ratingReminders !== undefined) row.rating_reminders = patch.ratingReminders
  if (Object.keys(row).length === 0) return { ok: true }

  const { error } = await admin.from('profiles').update(row).eq('id', userId)
  if (error) {
    if (isMissingColumn(error)) return { ok: false, error: 'Email preferences are not turned on yet. Try again later.' }
    throw new Error(error.message)
  }
  return { ok: true }
}

/** Longest name the account page will save. Enforced both in the form (maxLength) and here. */
export const MAX_NAME_LENGTH = 80

export type UpdateNameResult = { ok: true; name: string } | { ok: false; error: string }

/** Saves the caller's display name, scoped to their own row. Trims, and refuses empty or overlong. */
export async function updateName(admin: Admin, userId: string, name: string): Promise<UpdateNameResult> {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Enter a name.' }
  if (trimmed.length > MAX_NAME_LENGTH) return { ok: false, error: `Keep your name under ${MAX_NAME_LENGTH} characters.` }

  const { error } = await admin.from('profiles').update({ name: trimmed }).eq('id', userId)
  if (error) throw new Error(error.message)
  return { ok: true, name: trimmed }
}

export type AccountExport = {
  exportedAt: string
  jobs: Record<string, unknown>[]
  feedback: Record<string, unknown>[]
  credits: Record<string, unknown>[]
  deliveries: Record<string, unknown>[]
}

const JOB_COLUMNS =
  'id, title, primary_artist, source_language, target_language, status, created_at, parent_job_id, reroll_index, licence_terms_version'
const FEEDBACK_COLUMNS = 'job_id, rating, note, tags, created_at'
const CREDIT_COLUMNS = 'delta, reason, job_id, created_at'
const DELIVERY_COLUMNS = 'job_id, kind, filename, bytes, created_at'

/**
 * "Download my data": every row this account owns, scoped by user_id on every query, never
 * `select *`. Throws on any read failure rather than handing back a partial file that looks
 * complete.
 */
export async function exportAccountData(admin: Admin, userId: string): Promise<AccountExport> {
  const [jobs, feedback, credits, deliveries] = await Promise.all([
    admin
      .from('song_jobs')
      .select(JOB_COLUMNS)
      .eq('user_id', userId)
      .neq('delivery_profile', 'door1')
      .order('created_at', { ascending: false }),
    admin.from('job_feedback').select(FEEDBACK_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }),
    admin.from('song_credits').select(CREDIT_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }),
    admin.from('song_job_deliveries').select(DELIVERY_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }),
  ])
  for (const r of [jobs, feedback, credits, deliveries]) {
    if (r.error) throw new Error(r.error.message)
  }
  const jobRows = jobs.data ?? []
  // Door 1 deliveries (staff-made stems under info@'s uid) belong to jobs excluded above, so
  // only deliveries of the jobs actually exported are kept. `song_job_deliveries` carries no
  // profile of its own.
  const exportedJobIds = new Set(jobRows.map((j) => j.id))
  return {
    exportedAt: new Date().toISOString(),
    jobs: jobRows,
    feedback: feedback.data ?? [],
    credits: credits.data ?? [],
    deliveries: (deliveries.data ?? []).filter((d) => exportedJobIds.has(d.job_id)),
  }
}

export type RetireAccountResult = { ok: true } | { ok: false; error: string }

/**
 * The soft delete. SOFT: retires every voice model this user owns (the same terminal status
 * `app/studio/voices/actions.ts` already uses for a customer's own "retire this voice"), stamps
 * `profiles.retired_at` as a best-effort marker, and touches NOTHING else. Every ledger table
 * (song_jobs, song_credits, subscriptions, song_job_deliveries) is left exactly as it is: the
 * caller signs the user out after this returns ok, it does not delete a single row.
 */
export async function retireAccount(admin: Admin, userId: string): Promise<RetireAccountResult> {
  const { error: voicesError } = await admin
    .from('voice_models')
    .update({ status: 'retired' })
    .eq('user_id', userId)
    .neq('status', 'retired')
  if (voicesError) {
    return { ok: false, error: 'We could not retire your voice models. Try again in a moment.' }
  }

  const { error: markerError } = await admin
    .from('profiles')
    .update({ retired_at: new Date().toISOString() })
    .eq('id', userId)
  if (markerError && !isMissingColumn(markerError)) {
    return { ok: false, error: 'We could not close your account. Try again in a moment.' }
  }
  return { ok: true }
}
