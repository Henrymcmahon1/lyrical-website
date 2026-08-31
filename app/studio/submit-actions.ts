'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { mailCustomer, mailFounders } from '@/lib/mailer'
import { SongJobSchema } from '@/lib/song-job-schema'
import { verifyTurnstile } from '@/lib/turnstile'
import {
  jobConfirmationHtml,
  jobConfirmationSubject,
  jobConfirmationText,
  jobNotificationHtml,
  jobNotificationSubject,
  jobNotificationText,
  type SongJobEmailFields,
} from '@/lib/song-job-email'
import { pathBelongsTo } from '@/lib/song-upload'
import { currentUser, supabaseServer } from '@/lib/supabase-server'

/**
 * Tell people a song arrived. Never throws.
 *
 * The job is already saved by the time this runs, and that ordering is the whole point: a
 * submission that is safely in the database but whose notification failed is an inconvenience,
 * while one that was rejected because an email provider had a bad minute is a lost customer
 * and a lost master. Email is the least reliable thing in this path and it is treated as such.
 */
async function notify(fields: SongJobEmailFields): Promise<void> {
  await mailFounders(
    {
      replyTo: fields.submitterEmail,
      subject: jobNotificationSubject(fields),
      text: jobNotificationText(fields),
      html: jobNotificationHtml(fields),
    },
    'job-notification',
  )

  // The stranger gate lives in `mailCustomer`: only mail a rights holder from a verified
  // domain, never from an @resend.dev sender, which lands in spam and reads like a scam.
  await mailCustomer(
    {
      to: fields.submitterEmail,
      subject: jobConfirmationSubject(fields),
      text: jobConfirmationText(fields),
      html: jobConfirmationHtml(fields),
    },
    'job-confirmation',
  )
}

/**
 * Record a submission whose files are already in storage.
 *
 * The order matters and is worth explaining. Uploads go BROWSER DIRECT TO STORAGE, because a
 * WAV is 40 to 70MB and Vercel caps a request body at 4.5MB. So by the time this runs the
 * objects exist and this call is only writing the metadata that makes sense of them.
 *
 * That inverts the usual trust model: the client tells us where it put things. Two checks
 * follow from it.
 *
 *   1. Every path must sit under `{this user}/{this job}/`. Without that, a caller could
 *      attach somebody else's object to their own job and read it back through their own
 *      row. The storage policy already stops them WRITING there; this stops them CLAIMING it.
 *   2. The row is inserted with the user's own client, not the admin one, so the RLS check
 *      `auth.uid() = user_id` has to pass as well. Two independent gates, deliberately.
 *
 * A failed validation leaves orphaned objects in storage. That is accepted for now: they are
 * unreachable by anyone but their owner, and losing a few megabytes is better than deleting
 * files on a path an attacker can influence.
 */
export type SubmitResult = { ok: false; error: string }

/**
 * Returns only on failure. The success path calls `redirect()`, which throws, so `void` in the
 * signature is the honest description rather than a fictional success object the caller would
 * have to handle.
 */
export async function submitSongJob(raw: unknown): Promise<SubmitResult | void> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Your session expired. Sign in and try again.' }

  const input = raw as { jobId?: unknown; turnstileToken?: unknown }
  const jobId = typeof input?.jobId === 'string' ? input.jobId : ''
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return { ok: false, error: 'That submission looks malformed. Reload and try again.' }
  }

  /**
   * The bot challenge. A no-op until Turnstile is configured. The files are already in storage
   * by the time this runs, but that upload needed a signed-in session, and the sign-in form
   * carries the same challenge, so a bot cannot reach this point with an account it obtained by
   * a script. This is the second layer, in front of the job row and the two founder emails.
   */
  const token = typeof input?.turnstileToken === 'string' ? input.turnstileToken : ''
  const challenge = await verifyTurnstile(token, {
    remoteip: (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim(),
  })
  if (!challenge.ok) {
    return { ok: false, error: 'That did not look human. Reload the page and try again.' }
  }

  const parsed = SongJobSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Something in the form is not right.',
    }
  }
  const job = parsed.data

  for (const asset of job.assets) {
    if (!pathBelongsTo(asset.path, user.id, jobId)) {
      // Not a user error. Either the page is broken or somebody is probing, and neither
      // deserves a message that helps them work out which check failed.
      return { ok: false, error: 'That submission could not be verified. Reload and try again.' }
    }
  }

  const supabase = await supabaseServer()

  /**
   * The chosen voice, confirmed to belong to this customer.
   *
   * Read with the user's own client, so RLS answers with the row only if they own it. A forged
   * id, or one for a voice that has since been retired and removed, simply comes back empty and
   * is dropped to null rather than failing the whole submission: the song still goes, just
   * without a voice attached, which is the safe direction for that to fail.
   */
  let voiceId: string | null = null
  if (job.voiceId) {
    const { data: owned } = await supabase
      .from('voice_models')
      .select('id')
      .eq('id', job.voiceId)
      .maybeSingle()
    voiceId = owned?.id ?? null
  }

  const { error: jobError } = await supabase.from('song_jobs').insert({
    id: jobId,
    user_id: user.id,
    title: job.title,
    primary_artist: job.primaryArtist,
    source_language: job.sourceLanguage,
    target_language: job.targetLanguage,
    notes: job.notes ?? null,
    lyrics: job.lyrics ?? null,
    voice_id: voiceId,
    // The fallback preference, kept only when there is no specific voice. A song points at one or
    // the other, never both, so a chosen voice clears any preference the client also sent.
    voice_preference: voiceId ? null : (job.voicePreference ?? null),
    status: 'submitted',
  })

  if (jobError) {
    return { ok: false, error: 'We could not save that. Try again in a moment.' }
  }

  const { error: assetError } = await supabase.from('song_job_assets').insert(
    job.assets.map((a) => ({
      job_id: jobId,
      user_id: user.id,
      kind: a.kind,
      artist_name: a.artistName ?? null,
      part: a.part ?? null,
      path: a.path,
      filename: a.filename,
      bytes: a.bytes,
    })),
  )

  if (assetError) {
    // The job exists but has no files attached, which would look to staff like an empty
    // submission. Better to remove it and have the customer try again than to leave a job
    // nobody can action.
    await supabase.from('song_jobs').delete().eq('id', jobId)
    return { ok: false, error: 'We could not save the files. Try again in a moment.' }
  }

  // After the writes, and awaited rather than fired and forgotten: a serverless function that
  // returns before its promises settle is killed mid-send, and the email silently never goes.
  await notify({
    title: job.title,
    primaryArtist: job.primaryArtist,
    sourceLanguage: job.sourceLanguage,
    targetLanguage: job.targetLanguage,
    fileCount: job.assets.length,
    featureNames: job.assets
      .map((a) => a.artistName)
      .filter((n): n is string => Boolean(n) && n !== job.primaryArtist),
    notes: job.notes,
    lyrics: job.lyrics,
    submitterEmail: user.email ?? '',
  })

  redirect('/studio?submitted=1')
}
