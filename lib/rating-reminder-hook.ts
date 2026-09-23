import type { Tables } from './db/database.types'
import { ratingReminderHtml, ratingReminderSubject, ratingReminderText } from './rating-reminder-email'

/**
 * The orchestration behind `app/api/hooks/rating-reminder/route.ts`, the Vercel Cron target.
 * `deps.dueJobs` is expected to already be the database-filtered set: `song_jobs` rows delivered
 * 24 to ~48 hours ago with no `job_feedback` row. Everything this file decides on top of that is
 * business rule rather than a query: one email per person per run, skip a job already reminded,
 * respect the opt-out and the once-a-day product-email cap.
 */

/** Door 1 rows are excluded by the route's query; also skipped here, belt and braces. */
export type DueJob = Pick<Tables<'song_jobs'>, 'id' | 'user_id' | 'title'> &
  Partial<Pick<Tables<'song_jobs'>, 'delivery_profile'>>

export type EmailPrefs = { email: string | null; productEmails: boolean; ratingReminders: boolean }

export type RatingReminderDeps = {
  dueJobs: () => Promise<DueJob[]>
  alreadyReminded: (jobId: string) => Promise<boolean>
  emailPrefs: (userId: string) => Promise<EmailPrefs | null>
  productEmailAllowedToday: (userId: string) => Promise<boolean>
  sendMail: (
    mail: { to: string; subject: string; text: string; html: string },
    label: string,
  ) => Promise<boolean>
  logSend: (row: {
    userId: string
    toEmail: string
    slug: 'rating-reminder'
    jobId: string
  }) => Promise<void>
}

export type RatingReminderResult = { sent: string[]; skipped: number }

export async function runRatingReminders(deps: RatingReminderDeps): Promise<RatingReminderResult> {
  const jobs = await deps.dueJobs()
  const remindedUsers = new Set<string>()
  const sent: string[] = []

  for (const job of jobs) {
    if (job.delivery_profile === 'door1') continue
    // Never more than one product email per person per day, and never more than one per run
    // either: a person with two unrated tracks in the window gets one nudge, not two.
    if (remindedUsers.has(job.user_id)) continue
    if (await deps.alreadyReminded(job.id)) continue

    const prefs = await deps.emailPrefs(job.user_id)
    if (!prefs || !prefs.email) continue
    if (!prefs.productEmails || !prefs.ratingReminders) continue
    if (!(await deps.productEmailAllowedToday(job.user_id))) continue

    const fields = { title: job.title }
    const ok = await deps.sendMail(
      {
        to: prefs.email,
        subject: ratingReminderSubject(fields),
        text: ratingReminderText(fields),
        html: ratingReminderHtml(fields),
      },
      'rating-reminder',
    )

    if (ok) {
      await deps.logSend({ userId: job.user_id, toEmail: prefs.email, slug: 'rating-reminder', jobId: job.id })
      sent.push(job.id)
      remindedUsers.add(job.user_id)
    }
  }

  return { sent, skipped: jobs.length - sent.length }
}
