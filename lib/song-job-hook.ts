import { deliveredHtml, deliveredSubject, deliveredText } from './delivered-email'
import type { EmailSlug } from './email-log'
import { rerollsLeft } from './entitlement'
import { notMadeHtml, notMadeSubject, notMadeText } from './not-made-email'
import { rerollDeliveredHtml, rerollDeliveredSubject, rerollDeliveredText } from './reroll-delivered-email'

/**
 * The transition logic behind `app/api/hooks/song-job/route.ts`, a Supabase Database Webhook
 * target on `song_jobs` UPDATE. Split from the route the same way `lib/stripe-webhook.ts` is
 * split from `app/api/stripe/webhook/route.ts`: the decision is pure and testable, the route
 * wires it to a real Supabase client and a real mailer.
 */

export type SongJobRecord = {
  id: string
  user_id: string
  title: string
  target_language: string
  status: string
  parent_job_id: string | null
  reroll_index: number
}

export type SongJobWebhookPayload = {
  type: string
  table?: string
  record: SongJobRecord
  old_record?: SongJobRecord | null
}

/**
 * Which email, if any, a status change earns. Only a CHANGE into `delivered` or `rejected`
 * counts: a row updated again while already in one of those states (a purge stamp, for example)
 * must not re-fire. `reroll_index`/`parent_job_id` decide delivered vs re-roll-delivered; every
 * rejection, original or child, reads the same `track-not-made` copy.
 */
export function classifySlug(
  record: SongJobRecord,
  oldRecord: SongJobRecord | null | undefined,
): EmailSlug | null {
  if (record.status === oldRecord?.status) return null
  if (record.status === 'delivered') {
    return record.parent_job_id ? 'reroll-delivered' : 'track-delivered'
  }
  if (record.status === 'rejected') {
    return 'track-not-made'
  }
  return null
}

export type SongJobHookDeps = {
  alreadySentForJob: (jobId: string, slug: EmailSlug) => Promise<boolean>
  lookupEmail: (userId: string) => Promise<string | null>
  /** How many child jobs (re-rolls) the ORIGINAL job already has, including the one just delivered. */
  childCount: (originalJobId: string) => Promise<number>
  sendMail: (
    mail: { to: string; subject: string; text: string; html: string },
    label: string,
  ) => Promise<boolean>
  logSend: (row: {
    userId: string
    toEmail: string
    slug: EmailSlug
    jobId: string
  }) => Promise<void>
}

export type SongJobHookResult = { sent: boolean; slug: EmailSlug | null }

export async function handleSongJobWebhook(
  payload: SongJobWebhookPayload,
  deps: SongJobHookDeps,
): Promise<SongJobHookResult> {
  if (payload.type !== 'UPDATE') return { sent: false, slug: null }

  const slug = classifySlug(payload.record, payload.old_record)
  if (!slug) return { sent: false, slug: null }

  const jobId = payload.record.id
  if (await deps.alreadySentForJob(jobId, slug)) return { sent: false, slug }

  const email = await deps.lookupEmail(payload.record.user_id)
  if (!email) return { sent: false, slug }

  let mail: { subject: string; text: string; html: string }
  if (slug === 'track-delivered') {
    const fields = { title: payload.record.title, targetLanguage: payload.record.target_language }
    mail = { subject: deliveredSubject(fields), text: deliveredText(fields), html: deliveredHtml(fields) }
  } else if (slug === 'reroll-delivered') {
    const originalId = payload.record.parent_job_id as string
    const children = await deps.childCount(originalId)
    const fields = {
      title: payload.record.title,
      rerollIndex: payload.record.reroll_index,
      rerollsRemaining: rerollsLeft(children),
    }
    mail = {
      subject: rerollDeliveredSubject(fields),
      text: rerollDeliveredText(fields),
      html: rerollDeliveredHtml(fields),
    }
  } else {
    const fields = { title: payload.record.title }
    mail = { subject: notMadeSubject(fields), text: notMadeText(fields), html: notMadeHtml(fields) }
  }

  const sent = await deps.sendMail({ to: email, ...mail }, slug)
  // Only log a send that actually went out. A failed send (Resend down, key missing) must not
  // look like "already handled": the next real webhook delivery, or a manual re-trigger, needs
  // alreadySentForJob to still say no.
  if (sent) {
    await deps.logSend({ userId: payload.record.user_id, toEmail: email, slug, jobId })
  }
  return { sent, slug }
}
