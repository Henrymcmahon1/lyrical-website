'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE_MS,
  checkAdminPassword,
  signAdminSession,
} from '@/lib/admin-auth'
import { hasAdminSession } from '@/lib/admin-session'
import { canMove, MOVES_THAT_EMAIL, stampsFor } from '@/lib/job-transitions'
import { mailCustomer } from '@/lib/mailer'
import { clientKey, consume } from '@/lib/rate-limit'
import {
  jobAcceptedHtml,
  jobAcceptedSubject,
  jobAcceptedText,
  jobDeliveredHtml,
  jobDeliveredSubject,
  jobDeliveredText,
  type SongJobEmailFields,
} from '@/lib/song-job-email'
import type { JobStatus } from '@/lib/song-job-schema'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Everything `/queue` can do, for both tabs.
 *
 * Moved wholesale from `app/leads/actions.ts` rather than rewritten. That code was tested and
 * in use; the only change to the enquiry half is the cookie path and where it redirects.
 *
 * Every action re-checks the session. Each one is a POST endpoint that can be reached without
 * ever having rendered the page, so the guard on the page guards the page and nothing else.
 */

/**
 * Scoped to `/queue`, so the session cookie is never sent with a request for the marketing
 * site. Nothing else on the domain has any use for it.
 *
 * ⚠️ This path CHANGED from `/leads` when the console moved. A cookie issued under the old
 * path is simply not sent to the new one, so everybody signs in once more. That is the whole
 * cost of the move, and it is cheaper than scoping the cookie to `/` so it rides along with
 * every request for a marketing page.
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/queue',
  secure: process.env.NODE_ENV === 'production',
}

/** Five attempts per ten minutes per IP. Generous for a human, useless for a script. */
const LOGIN_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 10 * 60 * 1000

export async function login(formData: FormData) {
  /**
   * Throttle first. Best effort only, and measured as such.
   *
   * This limiter is per serverless instance, and a live test of six wrong passwords against
   * production was throttled ZERO times: Vercel spread the requests across instances and each
   * one saw its first attempt. So this is a speed bump against a single hot instance, not a
   * control anything should depend on.
   *
   * What actually protects this page is the password itself, plus the delay below. If per-IP
   * limiting ever needs to be real it has to live somewhere shared, in Redis or in Postgres,
   * rather than in a process Vercel may replace between two requests.
   */
  const limit = consume(
    clientKey(await headers(), 'queue-login'),
    LOGIN_ATTEMPTS,
    LOGIN_WINDOW_MS,
    Date.now(),
  )
  if (!limit.allowed) redirect('/queue?error=rate')

  const supplied = String(formData.get('password') ?? '')

  // `checkAdminPassword` fails closed when ADMIN_PASSWORD is unset, so an unconfigured
  // deployment refuses everybody rather than admitting everybody.
  if (!checkAdminPassword(supplied)) {
    // Deliberate delay, and only on failure. Unlike the counter above this works regardless of
    // which instance serves the request, because it costs wall-clock time every attempt.
    await new Promise((resolve) => setTimeout(resolve, 500))
    redirect('/queue?error=1')
  }

  const jar = await cookies()
  jar.set(ADMIN_COOKIE, signAdminSession(Date.now()), {
    ...COOKIE_OPTIONS,
    maxAge: Math.floor(ADMIN_MAX_AGE_MS / 1000),
  })
  redirect('/queue')
}

export async function logout() {
  const jar = await cookies()
  jar.set(ADMIN_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 })
  redirect('/queue')
}

// ── Enquiries ─────────────────────────────────────────────────────────────────

/**
 * Delete one enquiry, permanently.
 *
 * This exists for two reasons, and the second is the important one. A test row lands in the
 * inbox during setup and reads like a real lead. And this table holds real people's names,
 * addresses and free text: when somebody asks for their data to be removed, that has to be
 * possible without opening the database by hand.
 *
 * There is no soft delete. A row someone asked you to erase, kept under a flag, is still the
 * row they asked you to erase.
 *
 * Note that no equivalent exists for a song job. A submission is a record of what somebody
 * asserted about their rights and when, and its files are somebody else's master. See
 * `app/queue/SongsTab.tsx`.
 */
export async function deleteLead(formData: FormData) {
  if (!(await hasAdminSession())) redirect('/queue')

  const id = String(formData.get('id') ?? '')
  if (!id) return

  await supabaseAdmin().from('enquiries').delete().eq('id', id)

  revalidatePath('/queue')
  const all = formData.get('show') === 'all' ? '&show=all' : ''
  redirect(`/queue?tab=enquiries${all}&deleted=1`)
}

export async function setHandled(formData: FormData) {
  if (!(await hasAdminSession())) redirect('/queue')

  const id = String(formData.get('id') ?? '')
  if (!id) return

  const handled = formData.get('handled') === 'true'
  await supabaseAdmin()
    .from('enquiries')
    .update({ handled, handled_at: handled ? new Date().toISOString() : null })
    .eq('id', id)

  revalidatePath('/queue')
}

// ── Songs ─────────────────────────────────────────────────────────────────────

/** Where the customer's email lives. Auth owns it, not our tables. */
async function submitterEmail(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin().auth.admin.getUserById(userId)
  if (error || !data.user?.email) return ''
  return data.user.email
}

/**
 * Move a job along, and tell the customer if the move is one they should hear about.
 *
 * The order is deliberate: write first, mail second. A job whose status is correct but whose
 * email failed is a person who has to be told by hand. A job whose email went but whose write
 * failed is a person holding a promise the system does not know it made.
 *
 * ⚠️ Accepting is the commercially loaded move. It stamps `approved_at`, which starts the
 * turnaround clock, and since 2026-08-11 every offered pair carries that promise. The button
 * says so; this is the code that means it.
 *
 * Rejection sends NOTHING. Henry's decision, taken with the trade-off in front of him. It is
 * honoured here and paid for in `components/JobStatus.tsx`, which no longer claims the
 * customer has been contacted.
 */
export async function moveJob(formData: FormData) {
  if (!(await hasAdminSession())) redirect('/queue')

  const id = String(formData.get('id') ?? '')
  const to = String(formData.get('to') ?? '') as JobStatus
  const from = String(formData.get('from') ?? '')
  if (!id) return

  // Checked against the same table the buttons are drawn from, because a form post does not
  // have to have come from a page we rendered.
  if (!canMove(from, to)) redirect('/queue?error=move')

  const db = supabaseAdmin()
  const nowIso = new Date().toISOString()

  /**
   * `.eq('status', from)` is the concurrency guard, not decoration.
   *
   * Two founders both looking at the queue is the normal case, not the edge case. Without it,
   * one clicking Accept and the other clicking Reject a second later produces two successful
   * writes and two contradictory outcomes, and whichever email lands second is the one the
   * customer believes. With it, the second write matches no row and does nothing.
   */
  const { data, error } = await db
    .from('song_jobs')
    .update({ status: to, ...stampsFor(to, nowIso) })
    .eq('id', id)
    .eq('status', from)
    .select('id, title, primary_artist, source_language, target_language, user_id')

  if (error || !data?.length) {
    // No row matched means somebody else moved it first. Not an error worth a scary page.
    revalidatePath('/queue')
    redirect('/queue?error=stale')
  }

  const job = data[0]

  if (MOVES_THAT_EMAIL.includes(to)) {
    const email = await submitterEmail(job.user_id)
    if (email) {
      const fields: SongJobEmailFields = {
        title: job.title,
        primaryArtist: job.primary_artist,
        sourceLanguage: job.source_language,
        targetLanguage: job.target_language,
        // Neither template names a file, and the leak test proves it. Present so the shared
        // field type stays honest rather than growing a second half-empty variant.
        fileCount: 0,
        featureNames: [],
        submitterEmail: email,
      }

      // Awaited, not fired and forgotten: a serverless function that returns before its
      // promises settle is killed mid-send and the email silently never goes.
      if (to === 'approved') {
        await mailCustomer(
          {
            to: email,
            subject: jobAcceptedSubject(fields),
            text: jobAcceptedText(fields),
            html: jobAcceptedHtml(fields),
          },
          'job-accepted',
        )
      } else {
        await mailCustomer(
          {
            to: email,
            subject: jobDeliveredSubject(fields),
            text: jobDeliveredText(fields),
            html: jobDeliveredHtml(fields),
          },
          'job-delivered',
        )
      }
    }
  }

  revalidatePath('/queue')
  revalidatePath('/studio')
  redirect(`/queue?moved=${to}`)
}

/**
 * Save a staff note against a job.
 *
 * ⚠️ `supabase/schema.sql` claimed this column was "never selectable by the customer: see the
 * policy below, which lists columns rather than granting the whole row". That comment was
 * WRONG, and it was wrong in the dangerous direction. A Postgres RLS policy cannot restrict
 * columns; `song_jobs_own_select` grants the whole row to its owner, and a customer holding
 * their own session could read `internal_notes` straight off the REST API.
 *
 * The actual control is a column-level GRANT, which is now in `schema.sql` and applied to the
 * live database: `revoke select (internal_notes) on public.song_jobs from anon, authenticated`.
 * Found while wiring this action, 2026-08-11.
 */
export async function saveNote(formData: FormData) {
  if (!(await hasAdminSession())) redirect('/queue')

  const id = String(formData.get('id') ?? '')
  if (!id) return

  const note = String(formData.get('note') ?? '').slice(0, 4000)
  await supabaseAdmin()
    .from('song_jobs')
    .update({ internal_notes: note || null })
    .eq('id', id)

  revalidatePath('/queue')
}

// ── Voices ────────────────────────────────────────────────────────────────────

/**
 * Which moves a voice model may make. Same shape as the song lifecycle and enforced the same
 * way: the buttons are drawn from this, and so is the check, because a form post does not have
 * to have come from a page we rendered.
 *
 * `rejected` is reachable only from `collecting`, for the same reason a song can only be
 * refused before it is accepted: once we have told somebody their artist's voice is approved,
 * withdrawing that is a conversation rather than a button.
 */
const VOICE_MOVES: Record<string, readonly string[]> = {
  collecting: ['approved', 'rejected'],
  approved: ['training'],
  training: ['ready'],
  ready: [],
  rejected: [],
}

export async function moveVoice(formData: FormData) {
  if (!(await hasAdminSession())) redirect('/queue')

  const id = String(formData.get('id') ?? '')
  const to = String(formData.get('to') ?? '')
  const from = String(formData.get('from') ?? '')
  if (!id) return

  if (!VOICE_MOVES[from]?.includes(to)) redirect('/queue?tab=voices&error=move')

  /**
   * `.eq('status', from)` is the concurrency guard, exactly as on song jobs. Two founders in
   * the queue at once is the normal case, and without it one approving while the other rejects
   * produces two successful writes and two contradictory outcomes.
   */
  const { data, error } = await supabaseAdmin()
    .from('voice_models')
    .update({
      status: to,
      ...(to === 'approved' ? { approved_at: new Date().toISOString() } : {}),
    })
    .eq('id', id)
    .eq('status', from)
    .select('id')

  if (error || !data?.length) {
    revalidatePath('/queue')
    redirect('/queue?tab=voices&error=stale')
  }

  /*
   * No email either way, deliberately. Approving a voice is an internal readiness step rather
   * than something the customer is waiting on, and rejection is silent for the same reason it
   * is on songs: Henry's decision. The studio page states the status in words, which is where
   * somebody who cares will look.
   */
  revalidatePath('/queue')
  revalidatePath('/studio/voices')
  redirect(`/queue?tab=voices&moved=${to}`)
}
