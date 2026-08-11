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

/** Matches the ceiling in `song-job-schema.ts`. A 10 minute stereo master sits well under it. */
export const MAX_BYTES = 500 * 1024 * 1024

export function hasAcceptedExtension(filename: string): boolean {
  const lower = filename.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function describeRejection(file: { name: string; size: number }): string | null {
  if (!hasAcceptedExtension(file.name)) {
    return `${file.name} is not a lossless file. Send a WAV, AIFF or FLAC: an mp3 has already thrown away what we need.`
  }
  if (file.size > MAX_BYTES) {
    return `${file.name} is larger than 500MB.`
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
