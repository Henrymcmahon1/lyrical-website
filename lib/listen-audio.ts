import { DEMO_MAX_AGE_MS } from './demo-auth'
import { supabaseAdmin } from './supabase-admin'

/**
 * Signed URLs for the /listen recordings, which live in a PRIVATE Supabase bucket.
 *
 * They were briefly in `public/`, which was wrong twice over.
 *
 * They vanished. The files are not in git, correctly, because this repository is public and
 * these are recordings we hold no licence to distribute. They only reached production because
 * `vercel --prod` uploads the working directory, so the first deployment made from anywhere
 * else silently dropped them and the page served players that 404ed. That happened within an
 * hour of shipping.
 *
 * And they were readable by anyone. `/audio/listen/original.mp3` was fetchable without the
 * password: the page was gated, the audio was not, so the gate protected the presentation and
 * nothing else.
 *
 * A private bucket fixes both. Storage is independent of deployments, so no deploy can drop
 * it, and nothing is readable without a URL this server signs for somebody who already got
 * past the password.
 */

/** The bucket, created by `supabase/schema.sql`. Private: there is no public read policy. */
export const LISTEN_BUCKET = 'listen'

/**
 * Signed for as long as a session lasts.
 *
 * Shorter and a listener who left the tab open mid-meeting finds playback dies partway
 * through. Longer and a URL copied out of the page outlives the session it came from, which
 * is the whole thing the gate exists to prevent.
 */
const SIGNED_URL_TTL_S = Math.floor(DEMO_MAX_AGE_MS / 1000)

export type SignedTrack = { key: string; url: string | null }

/**
 * Sign what exists; report the rest as absent.
 *
 * Availability is DERIVED, never declared. The previous version carried a `hasAudio` boolean
 * in the manifest, which is a second source of truth that goes stale the moment a file moves
 * and then makes the page lie about what it has. Asking storage is the only answer that
 * cannot drift.
 *
 * Never throws. Storage being unreachable must render "not loaded yet" on a page the visitor
 * already unlocked, not a 500 that tells them nothing.
 */
export async function signListenTracks(keys: string[]): Promise<SignedTrack[]> {
  let signed: Record<string, string> = {}

  try {
    const { data, error } = await supabaseAdmin()
      .storage.from(LISTEN_BUCKET)
      .createSignedUrls(keys, SIGNED_URL_TTL_S)

    if (error) {
      console.error('[listen] could not sign storage URLs', error)
    } else {
      for (const row of data ?? []) {
        // createSignedUrls resolves per object: a missing one comes back with its own error
        // rather than failing the batch, which is exactly the behaviour this page wants.
        if (row.signedUrl && !row.error && row.path) signed[row.path] = row.signedUrl
      }
    }
  } catch (e) {
    console.error('[listen] storage unreachable', e)
    signed = {}
  }

  return keys.map((key) => ({ key, url: signed[key] ?? null }))
}
