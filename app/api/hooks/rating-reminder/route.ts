import { alreadySentForJob, logSend, productEmailAllowedToday } from '@/lib/email-log'
import { requireBearerSecret } from '@/lib/hook-auth'
import { mailCustomer } from '@/lib/mailer'
import { runRatingReminders, type DueJob, type EmailPrefs } from '@/lib/rating-reminder-hook'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

/**
 * The Vercel Cron target for the 24-hour rating reminder. Proposed hourly in `vercel.json`;
 * Henry can widen it. See `lib/rating-reminder-hook.ts` for the business rules, unit tested on
 * their own against injected deps: this route only wires them to real tables.
 *
 * `song_jobs` has no "already reminded" flag of its own; that lives in `email_log`
 * (`alreadySentForJob`, slug `rating-reminder`), so a job stays in the 24-48h window across
 * several cron runs without being re-mailed each time.
 *
 * Always 200 except on a bad or missing Authorization bearer token: see
 * `app/api/hooks/song-job/route.ts` for the same reasoning, shared via `lib/hook-auth.ts`.
 */

const WINDOW_START_MS = 24 * 60 * 60 * 1000
const WINDOW_END_MS = 48 * 60 * 60 * 1000

export async function GET(request: Request) {
  const gate = requireBearerSecret(request.headers.get('authorization'), 'CRON_SECRET')
  if (!gate.ok) return new Response(gate.body, { status: gate.status })

  const admin = supabaseAdmin()

  try {
    const result = await runRatingReminders({
      dueJobs: async () => {
        const now = Date.now()
        const from = new Date(now - WINDOW_END_MS).toISOString()
        const to = new Date(now - WINDOW_START_MS).toISOString()

        const { data: rows, error } = await admin
          .from('song_jobs')
          .select('id, user_id, title, delivery_profile')
          .eq('status', 'delivered')
          // Door 1 is staff-made for a signed artist: no rating reminder, ever.
          .neq('delivery_profile', 'door1')
          .gte('delivered_at', from)
          .lt('delivered_at', to)
        if (error) throw new Error(error.message)

        const jobs = (rows ?? []) as DueJob[]
        if (!jobs.length) return []

        const { data: rated, error: feedbackError } = await admin
          .from('job_feedback')
          .select('job_id')
          .in(
            'job_id',
            jobs.map((j) => j.id),
          )
        if (feedbackError) throw new Error(feedbackError.message)

        const ratedIds = new Set((rated ?? []).map((r) => (r as { job_id: string }).job_id))
        return jobs.filter((j) => !ratedIds.has(j.id))
      },
      alreadyReminded: (jobId) => alreadySentForJob(admin, jobId, 'rating-reminder'),
      emailPrefs: async (userId): Promise<EmailPrefs | null> => {
        const [{ data: user, error: userError }, { data: profile, error: profileError }] = await Promise.all([
          admin.auth.admin.getUserById(userId),
          admin.from('profiles').select('product_emails, rating_reminders').eq('id', userId).maybeSingle(),
        ])
        if (userError) throw new Error(userError.message)
        if (profileError) throw new Error(profileError.message)
        return {
          email: user.user?.email ?? null,
          // Defaults true (migration 004), so a profile row that predates the column still opts in.
          productEmails: profile?.product_emails ?? true,
          ratingReminders: profile?.rating_reminders ?? true,
        }
      },
      productEmailAllowedToday: (userId) => productEmailAllowedToday(admin, userId),
      sendMail: (mail, label) => mailCustomer(mail, label),
      logSend: (row) => logSend(admin, row),
    })
    return Response.json({ ok: true, ...result })
  } catch (e) {
    console.error('[hooks/rating-reminder] failed', e)
    return new Response('ok', { status: 200 })
  }
}
