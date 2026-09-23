'use server'

import { randomInt } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { REROLLS_PER_TRACK } from '@/lib/plans'
import { currentUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * A free re-roll of a delivered track. Privileged (service role) because the child row carries
 * `pipeline_state='queued'`, the trigger that spends render money, and the customer's own
 * client must never set it. Rules, all checked before the insert: owner, delivered, family
 * under the cap, a thumbs-down with a note on THIS job. The child hangs off the ORIGINAL, never
 * off another child, so the poller finds stems under `work/website/<original>/`. No
 * `song_job_assets` rows: the poller resolves stems from the parent.
 */
export type RerollResult = { ok: true; childId: string } | { ok: false; error: string }
// Not exported: a 'use server' module may only export async functions. The bar and the studio
// page carry the same deck string.
const REROLL_CLOSED = 'The re-roll window for this song has closed. Make it again to start fresh.'
const JOB_COLUMNS =
  'id, user_id, status, parent_job_id, title, primary_artist, source_language, target_language, lyrics, voice_id, voice_preference, licence_terms_version'

export async function requestReroll(jobId: string): Promise<RerollResult> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Your session expired. Sign in and try again.' }
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return { ok: false, error: 'That song could not be found.' }

  const admin = supabaseAdmin()
  const { data: job } = await admin
    .from('song_jobs')
    .select(JOB_COLUMNS)
    .eq('id', jobId)
    .eq('user_id', user.id)
    .neq('delivery_profile', 'door1')
    .maybeSingle()
  if (!job) return { ok: false, error: 'That song could not be found.' }
  if (job.status !== 'delivered') return { ok: false, error: 'A track can be re-rolled once it has been delivered.' }

  const original = job.parent_job_id ?? job.id
  const { count } = await admin
    .from('song_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('parent_job_id', original)
    .neq('delivery_profile', 'door1')
  const children = count ?? 0
  if (children >= REROLLS_PER_TRACK) return { ok: false, error: REROLL_CLOSED }

  const { data: down } = await admin
    .from('job_feedback').select('id')
    .eq('job_id', jobId).eq('user_id', user.id).eq('rating', 'down').not('note', 'is', null)
    .maybeSingle()
  if (!down) return { ok: false, error: 'Tell us what is wrong with this take first, then re-roll it.' }

  const { data: child, error } = await admin
    .from('song_jobs')
    .insert({
      user_id: user.id,
      parent_job_id: original,
      reroll_index: children + 1,
      seed: randomInt(0, 2 ** 31),
      title: job.title,
      primary_artist: job.primary_artist,
      source_language: job.source_language,
      target_language: job.target_language,
      lyrics: job.lyrics,
      voice_id: job.voice_id,
      voice_preference: job.voice_preference,
      licence_terms_version: job.licence_terms_version,
      route: 'auto',
      pipeline_state: 'queued',
      status: 'approved',
      approved_at: new Date().toISOString(),
      quota_consumed_at: null,
    })
    .select('id')
    .single()
  if (error || !child) {
    console.error('[reroll] insert refused', error)
    return { ok: false, error: 'We could not start that re-roll. Try again in a moment.' }
  }
  revalidatePath('/studio')
  return { ok: true, childId: child.id }
}

export async function requestRerollForm(_prev: RerollResult | null, formData: FormData): Promise<RerollResult> {
  return requestReroll(String(formData.get('jobId') ?? ''))
}
