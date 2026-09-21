'use server'

import { headers } from 'next/headers'
import { SelfServeJobSchema } from '@/lib/song-job-schema'
import { verifyTurnstile } from '@/lib/turnstile'
import { LICENCE_TERMS_VERSION, RIGHTS_TERMS_VERSION } from '@/lib/terms'
import { pathBelongsTo } from '@/lib/song-upload'
import { currentUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getEntitlementFor } from '@/lib/entitlement-db'
import { consumeCredit } from '@/lib/credits'

/**
 * Door 2: the AUTOMATED self-serve submit.
 *
 * The manual funnel (`submitSongJob`) writes `status='submitted'` and waits for a human in
 * `/queue`. This one is the opposite: it quota-gates the customer, then stamps the job
 * `route='auto'` + `pipeline_state='queued'` so the render worker (the always-on render PC
 * polling Supabase) claims and runs it with no human in the loop, and delivers the cover back.
 *
 * Why this MUST be a privileged server action, not the user's client:
 *   - `pipeline_state='queued'` is the trigger that spends GPU/LLM money. The song_jobs RLS
 *     insert policy only checks `user_id = auth.uid()`, so a user's own client could self-stamp
 *     `queued` and bypass the quota. The gate therefore runs here on the service-role client,
 *     after the session is verified, and the client is never trusted to set the pipeline state.
 *
 * Contract the render poller depends on (do not drift): a `song_jobs` row with
 * `pipeline_state='queued'` plus `song_job_assets` rows of kind `instrumental` and `vocal`
 * under `submissions/{userId}/{jobId}/`.
 */

export type SelfServeResult = { ok: true; jobId: string } | { ok: false; error: string }

/**
 * A short-lived signed URL for a delivered cover, so the customer can play it in the studio.
 *
 * The `deliveries` bucket is private. Rather than open a storage RLS policy for it, this reads
 * the delivery on the service-role client but scopes it to a job THIS user owns, then signs a
 * URL. A job id for someone else's song simply finds no owned delivery and returns null.
 */
export async function getDeliveredCoverUrl(jobId: string): Promise<string | null> {
  const user = await currentUser()
  if (!user || !/^[0-9a-f-]{36}$/i.test(jobId)) return null
  const admin = supabaseAdmin()
  const { data: owned } = await admin
    .from('song_jobs')
    .select('id')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!owned) return null
  const { data: deliveries } = await admin
    .from('song_job_deliveries')
    .select('path')
    .eq('job_id', jobId)
    .eq('kind', 'cover')
    .order('created_at', { ascending: false })
    .limit(1)
  const path = deliveries?.[0]?.path
  if (!path) return null
  const { data: signed } = await admin.storage.from('deliveries').createSignedUrl(path, 3600)
  return signed?.signedUrl ?? null
}

export async function submitSelfServeJob(raw: unknown): Promise<SelfServeResult> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Your session expired. Sign in and try again.' }

  const input = raw as { jobId?: unknown; turnstileToken?: unknown }
  const jobId = typeof input?.jobId === 'string' ? input.jobId : ''
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return { ok: false, error: 'That submission looks malformed. Reload and try again.' }
  }

  const token = typeof input?.turnstileToken === 'string' ? input.turnstileToken : ''
  const challenge = await verifyTurnstile(token, {
    remoteip: (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim(),
  })
  if (!challenge.ok) {
    return { ok: false, error: 'That did not look human. Reload the page and try again.' }
  }

  const parsed = SelfServeJobSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Something in the form is not right.' }
  }
  const job = parsed.data

  // The automated path is bring-your-own-stems: the render needs a clean instrumental to mix
  // over and the customer's own vocal to re-timbre to (zero-shot). A full mix cannot be split
  // here, so it is not enough on its own.
  const kinds = new Set(job.assets.map((a) => a.kind))
  if (!kinds.has('instrumental') || !kinds.has('vocal')) {
    return { ok: false, error: 'Automated covers need both an instrumental and your vocal.' }
  }

  for (const asset of job.assets) {
    if (!pathBelongsTo(asset.path, user.id, jobId)) {
      return { ok: false, error: 'That submission could not be verified. Reload and try again.' }
    }
  }

  const admin = supabaseAdmin()

  // Voice ownership, checked on the service-role client but scoped to this user by the filter.
  let voiceId: string | null = null
  if (job.voiceId) {
    const { data: owned } = await admin
      .from('voice_models')
      .select('id')
      .eq('id', job.voiceId)
      .eq('user_id', user.id)
      .maybeSingle()
    voiceId = owned?.id ?? null
  }

  // Entitlement gate: an active plan with tracks left, else a Single credit. Fails closed.
  const entitlement = await getEntitlementFor(user.id, admin)
  if (!entitlement.ok) {
    return { ok: false, error: 'You are out of tracks for this period. Upgrade, buy a Single, or wait for it to renew.' }
  }

  const now = new Date().toISOString()
  const { error: jobError } = await admin.from('song_jobs').insert({
    id: jobId,
    user_id: user.id,
    title: job.title,
    primary_artist: job.primaryArtist,
    source_language: job.sourceLanguage,
    target_language: job.targetLanguage,
    notes: job.notes ?? null,
    lyrics: job.lyrics ?? null,
    voice_id: voiceId,
    voice_preference: voiceId ? null : (job.voicePreference ?? null),
    rights_terms_version: RIGHTS_TERMS_VERSION,
    licence_terms_version: LICENCE_TERMS_VERSION,
    // The automated contract: approved immediately, routed to the render worker, queued for it.
    status: 'approved',
    approved_at: now,
    route: 'auto',
    pipeline_state: 'queued',
    quota_consumed_at: now,
  })
  if (jobError) {
    return { ok: false, error: 'We could not save that. Try again in a moment.' }
  }

  const { error: assetError } = await admin.from('song_job_assets').insert(
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
    await admin.from('song_jobs').delete().eq('id', jobId)
    return { ok: false, error: 'We could not save the files. Try again in a moment.' }
  }

  // A credit-funded track spends the credit in the same path as the job insert. If the ledger
  // write fails the job goes too (assets cascade), so nobody gets a free render.
  if (entitlement.source === 'credit') {
    const consumed = await consumeCredit(admin, { userId: user.id, jobId })
    if (!consumed) {
      await admin.from('song_jobs').delete().eq('id', jobId)
      return { ok: false, error: 'We could not apply your credit. Try again in a moment.' }
    }
  }

  // The first time this customer accepts the personal-use terms, stamp the profile. No-op after.
  await admin.from('profiles').update({ licence_terms_version: LICENCE_TERMS_VERSION }).eq('id', user.id).is('licence_terms_version', null)

  return { ok: true, jobId }
}
