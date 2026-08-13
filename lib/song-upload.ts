import type { AssetKind } from './song-job-schema'

/**
 * Where an uploaded file lives, and what we accept.
 *
 * The path shape is load bearing, not cosmetic. The storage policies in `supabase/schema.sql`
 * compare the FIRST PATH SEGMENT to `auth.uid()`, so `{user}/{job}/{file}` is what stops a
 * signed in customer writing into, or reading out of, another label's folder. Change the shape
 * here and you silently remove that protection.
 */
export const SUBMISSIONS_BUCKET = 'submissions'

/**
 * Lossless only, and the reason is worth stating because it costs some visitors.
 *
 * The pitch is an untouched original instrumental with a new vocal over it. Handed an mp3, we
 * would be rebuilding a master from something already thrown away, and the result is audibly
 * worse in exactly the places a rights holder listens. Henry specified WAV; AIFF and FLAC are
 * the same information in a different container, so refusing them would cost submissions and
 * protect nothing.
 */
export const ACCEPTED_EXTENSIONS = ['.wav', '.aiff', '.aif', '.flac'] as const
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(',')

/**
 * ⚠️ THE SUPABASE FREE PLAN'S FIXED PER-FILE LIMIT. Corrected from 500MB on 2026-08-12.
 *
 * This said 500MB and storage said 50MB. The dashboard states it plainly: "Free Plan has a
 * fixed upload file size limit of 50 MB", and it is not configurable. So the form advertised a
 * ceiling ten times higher than the one that actually applied, and an upload over 50MB was
 * rejected by storage AFTER the customer had waited through it, with an error that explained
 * nothing.
 *
 * That was not theoretical. A three minute 48kHz/24-bit STEREO WAV is about 52MB, so a normal
 * WAV master was already over. The one real submission to date was two FLACs totalling 36MB,
 * which is the only reason it has not bitten yet.
 *
 * The way out for a customer is FLAC, which is lossless and roughly 45% smaller, so the same
 * master lands around 30MB. `describeRejection` says so rather than just naming the limit.
 *
 * If the project ever moves to Supabase Pro this becomes configurable up to 500GB and this
 * constant is the only place that has to change.
 */
export const MAX_BYTES = 50 * 1024 * 1024

export function hasAcceptedExtension(filename: string): boolean {
  const lower = filename.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function describeRejection(file: { name: string; size: number }): string | null {
  if (!hasAcceptedExtension(file.name)) {
    return `${file.name} is not a lossless file. Send a WAV, AIFF or FLAC: an mp3 has already thrown away what we need.`
  }
  if (file.size > MAX_BYTES) {
    // Names the way out, not just the limit. FLAC is lossless and about 45% smaller, so for a
    // normal master this IS the fix rather than a suggestion to re-export something smaller.
    return `${file.name} is larger than 50MB. Export it as FLAC, which is lossless and roughly half the size of the same WAV.`
  }
  if (file.size === 0) {
    return `${file.name} is empty.`
  }
  return null
}

/**
 * The object key for one upload.
 *
 * `index` keeps two vocals from colliding when a track has a feature. The original filename is
 * NOT used in the path: it is stored alongside for humans, but a customer's filename can carry
 * anything, and letting it decide a storage key is how you end up with traversal bugs.
 */
export function assetPath(
  userId: string,
  jobId: string,
  kind: AssetKind,
  index: number,
  filename: string,
): string {
  const dot = filename.lastIndexOf('.')
  const ext = dot > -1 ? filename.slice(dot).toLowerCase() : '.wav'
  return `${userId}/${jobId}/${kind}-${index}${ext}`
}

/** The check the server repeats before trusting a path the client claims to have written. */
export function pathBelongsTo(path: string, userId: string, jobId: string): boolean {
  return path.startsWith(`${userId}/${jobId}/`) && !path.includes('..')
}
