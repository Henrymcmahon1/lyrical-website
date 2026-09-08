import { mailCustomer } from '@/lib/mailer'
import {
  jobDeliveredHtml,
  jobDeliveredSubject,
  jobDeliveredText,
  type SongJobEmailFields,
} from '@/lib/song-job-email'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Send the "it's ready" email when the pipeline delivers a cover.
 *
 * When a founder moves a job in `/queue`, `moveJob` sends this email. But a self-serve delivery
 * is a service-role write straight to the database (the pipeline sets `status='delivered'`),
 * which never runs `moveJob`. So the same email is dispatched here instead, from the delivery
 * webhook. The wording, and the rule that NO signed URL or file ever appears in it, live in
 * `lib/song-job-email.ts`; this only decides the recipient and hands off to the mailer.
 */
export type DeliveredJob = {
  title: string
  primary_artist: string
  source_language: string
  target_language: string
  user_id: string
}

/** Where the customer's email lives. Auth owns it, not our tables (mirrors app/queue/actions). */
async function submitterEmail(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin().auth.admin.getUserById(userId)
  if (error || !data.user?.email) return ''
  return data.user.email
}

export async function sendDeliveredEmail(job: DeliveredJob): Promise<boolean> {
  const email = await submitterEmail(job.user_id)
  if (!email) return false

  const fields: SongJobEmailFields = {
    title: job.title,
    primaryArtist: job.primary_artist,
    sourceLanguage: job.source_language,
    targetLanguage: job.target_language,
    // Neither delivered-template names a file, and the leak test proves it.
    fileCount: 0,
    featureNames: [],
    submitterEmail: email,
  }

  return mailCustomer(
    {
      to: email,
      subject: jobDeliveredSubject(fields),
      text: jobDeliveredText(fields),
      html: jobDeliveredHtml(fields),
    },
    'job-delivered',
  )
}
