'use server'

import { revalidatePath } from 'next/cache'
import { FeedbackSchema } from '@/lib/feedback-schema'
import { currentUser, supabaseServer } from '@/lib/supabase-server'

/**
 * One rating per delivered track. Runs with the USER's client so `job_feedback` RLS is the
 * control: insert and update only where `auth.uid() = user_id`. The song_jobs lookup is the
 * user's client too, so a job id that is not theirs finds nothing and nothing is written.
 */
export type FeedbackResult = { ok: true } | { ok: false; error: string }

export async function submitFeedback(raw: unknown): Promise<FeedbackResult> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Your session expired. Sign in and try again.' }
  const parsed = FeedbackSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Something in the form is not right.' }
  }
  const { jobId, rating, note, tags } = parsed.data

  const supabase = await supabaseServer()
  const { data: job } = await supabase
    .from('song_jobs')
    .select('id')
    .eq('id', jobId)
    .neq('delivery_profile', 'door1')
    .maybeSingle()
  if (!job) return { ok: false, error: 'That song could not be found.' }

  const { error } = await supabase
    .from('job_feedback')
    .upsert({ job_id: jobId, user_id: user.id, rating, note: note || null, tags }, { onConflict: 'job_id,user_id' })
  if (error) {
    console.error('[feedback] upsert refused', error)
    return { ok: false, error: 'We could not save that. Try again in a moment.' }
  }
  revalidatePath('/studio')
  return { ok: true }
}

/** `useActionState` shape. Also what a no-JS form post calls, so the bar works without React. */
export async function submitFeedbackForm(_prev: FeedbackResult | null, formData: FormData): Promise<FeedbackResult> {
  return submitFeedback({
    jobId: formData.get('jobId'),
    rating: formData.get('rating'),
    note: String(formData.get('note') ?? '') || undefined,
    tags: formData.getAll('tags'),
  })
}
