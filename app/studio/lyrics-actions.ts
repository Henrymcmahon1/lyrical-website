'use server'

import { revalidatePath } from 'next/cache'
import { MAX_LYRICS_CHARS, normaliseLyrics } from '@/lib/lyrics'
import { currentUser, supabaseServer } from '@/lib/supabase-server'

/**
 * Let a customer correct their own lyric sheet, and nothing else.
 *
 * Henry's decision, 2026-08-12. Until now a submitted job was frozen: `song_jobs` had no
 * customer update policy at all, deliberately, because the row records what somebody asserted
 * and when. Lyrics are the exception worth making, because a typo in a lyric sheet goes
 * straight into the output and the alternative was the customer emailing us to fix a comma.
 *
 * ## Three gates, and none of them is this function
 *
 * This runs with the USER's client, never the admin one, so the database decides:
 *
 *   COLUMN. `grant update (lyrics)` is the only update privilege the `authenticated` role has
 *   on this table. Even a forged request cannot touch `status`, `approved_at` or
 *   `rights_warranted_at`, which is the field an agreement is argued from.
 *
 *   ROW. `song_jobs_own_lyrics_update` restricts it to `auth.uid() = user_id`.
 *
 *   TIME. The same policy requires `status = 'submitted'`, so the sheet stops moving the
 *   moment we accept the job and start working from it.
 *
 * ⚠️ The policy alone would NOT have been enough, and that is the mistake worth remembering. An
 * RLS policy decides which ROWS may be updated and cannot restrict columns, exactly as it could
 * not for `internal_notes`. Without the column grant, a `for update` policy would have let a
 * customer rewrite their own status to 'delivered'.
 */
export type LyricsResult = { ok: boolean; error?: string }

export async function updateLyrics(formData: FormData): Promise<LyricsResult> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Your session expired. Sign in and try again.' }

  const jobId = String(formData.get('jobId') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return { ok: false, error: 'That song could not be found.' }
  }

  const lyrics = normaliseLyrics(String(formData.get('lyrics') ?? ''))
  if (lyrics.length > MAX_LYRICS_CHARS) {
    return { ok: false, error: 'That is longer than a lyric sheet should be.' }
  }

  const supabase = await supabaseServer()

  /*
   * `.eq('status', 'submitted')` as well as the policy. The policy is the control and this is
   * the honest answer: without it a write blocked by RLS returns zero rows and looks identical
   * to a successful no-op, so the customer would be told their correction saved when it did
   * not. With it we can tell them the real reason.
   */
  const { data, error } = await supabase
    .from('song_jobs')
    .update({ lyrics: lyrics || null })
    .eq('id', jobId)
    .eq('status', 'submitted')
    .select('id')

  if (error) {
    console.error('[lyrics] update refused', error)
    return { ok: false, error: 'We could not save that. Try again in a moment.' }
  }
  if (!data?.length) {
    return {
      ok: false,
      error: 'That song has already been accepted, so the lyrics are locked. Write to us and we will change them.',
    }
  }

  revalidatePath('/studio')
  return { ok: true }
}
