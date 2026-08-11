'use server'

import { redirect } from 'next/navigation'
import { SongJobSchema } from '@/lib/song-job-schema'
import { pathBelongsTo } from '@/lib/song-upload'
import { currentUser, supabaseServer } from '@/lib/supabase-server'

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

  const input = raw as { jobId?: unknown }
  const jobId = typeof input?.jobId === 'string' ? input.jobId : ''
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return { ok: false, error: 'That submission looks malformed. Reload and try again.' }
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

  const { error: jobError } = await supabase.from('song_jobs').insert({
    id: jobId,
    user_id: user.id,
    title: job.title,
    primary_artist: job.primaryArtist,
    source_language: job.sourceLanguage,
    target_language: job.targetLanguage,
    notes: job.notes ?? null,
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

  redirect('/studio?submitted=1')
}
