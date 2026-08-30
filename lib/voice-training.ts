/**
 * Clean vocals for training an artist's voice model.
 *
 * A voice model belongs to an ARTIST, not to a song. It is built once from twenty to thirty
 * minutes of isolated vocal, and then every future song by that artist uses it. That is why
 * this lives beside `song_jobs` rather than inside it: attaching a training set to a song means
 * the second song either re-uploads the same half gigabyte or inherits it by a rule nobody can
 * see.
 *
 * ## The storage ceiling is real and it shapes everything here
 *
 * Supabase's free plan has a HARD 50MB per-file upload limit, stated in the dashboard as
 * "Free Plan has a fixed upload file size limit of 50 MB", and it is not configurable. Total
 * storage is 1GB. Henry's decision on 2026-08-12 was to stay on the free plan and cap tightly
 * rather than pay for Pro, with those numbers in front of him.
 *
 * Everything below follows from that:
 *
 * **Many files, not one.** Thirty minutes cannot be a single object. At mono 48k/24-bit a file
 * has to stay under about six minutes to fit, which is roughly one song's acapella, so a
 * training set is naturally eight to ten files.
 *
 * **Mono only.** RVC trains on mono and resamples anyway, so a stereo upload doubles the
 * storage for audio the trainer discards half of. This is checked before upload rather than
 * asked politely, because a polite request costs 1GB divided by two.
 *
 * **FLAC first.** Lossless and roughly 45% smaller than the same WAV. It is the difference
 * between seven artists fitting in the free tier and three.
 */

/** The private bucket. Created by `supabase/schema.sql`, no public read policy. */
export const VOICE_BUCKET = 'voice-training'

/**
 * ⚠️ The Supabase free plan's fixed per-file limit. NOT a preference.
 *
 * An upload over this is rejected by storage itself, after the customer has waited through it,
 * with an error that does not explain why. Checking it in the browser first is the difference
 * between "that file is too large, send FLAC" and a failure they cannot act on.
 *
 * If the project ever moves to Pro this becomes configurable up to 500GB and this constant is
 * the only place that needs to change.
 */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

/** What a usable training set needs, in seconds of audio. Henry's figures. */
export const TRAINING_MINIMUM_SECONDS = 20 * 60
export const TRAINING_TARGET_SECONDS = 30 * 60

/**
 * Lossless only, same reasoning as a song master: an mp3 has already thrown away the detail a
 * voice model is trying to learn. FLAC is listed first because the form recommends it.
 */
export const VOICE_EXTENSIONS = ['.flac', '.wav', '.aiff', '.aif'] as const
export const VOICE_ACCEPT_ATTRIBUTE = VOICE_EXTENSIONS.join(',')

export function hasVoiceExtension(filename: string): boolean {
  const lower = filename.toLowerCase()
  return VOICE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

// ── Reading what a file actually is, before uploading it ──────────────────────

export type AudioFacts = {
  channels: number
  sampleRate: number
  seconds: number
}

/**
 * Read channel count, sample rate and duration out of a WAV header.
 *
 * Header only: this walks the RIFF chunk list and never touches the samples, so it costs a few
 * hundred bytes regardless of how large the file is. That matters because the alternative,
 * `decodeAudioData`, decompresses the whole thing into memory to answer a question the first
 * 44 bytes already contain.
 *
 * Returns null for anything it does not recognise rather than guessing. A wrong answer here
 * would reject a legitimate file, which is worse than not checking.
 */
export function readWavFacts(buffer: ArrayBuffer): AudioFacts | null {
  const view = new DataView(buffer)
  if (buffer.byteLength < 44) return null

  const tag = (offset: number) =>
    String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    )

  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null

  let channels = 0
  let sampleRate = 0
  let bitsPerSample = 0
  let dataBytes = 0

  // Chunks are not in a guaranteed order and a file may carry several before `data`, so this
  // walks rather than assuming the canonical 44-byte layout.
  let offset = 12
  while (offset + 8 <= buffer.byteLength) {
    const id = tag(offset)
    const size = view.getUint32(offset + 4, true)

    if (id === 'fmt ' && offset + 24 <= buffer.byteLength) {
      channels = view.getUint16(offset + 10, true)
      sampleRate = view.getUint32(offset + 12, true)
      bitsPerSample = view.getUint16(offset + 22, true)
    } else if (id === 'data') {
      dataBytes = size
      break
    }

    // Chunks are word aligned: an odd size is followed by a pad byte.
    offset += 8 + size + (size % 2)
  }

  if (!channels || !sampleRate || !bitsPerSample) return null

  const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8)
  if (!bytesPerSecond) return null

  /*
   * A `data` size of 0 happens in files written by a stream that never went back to patch the
   * header. Falling back to the file length minus the header is close enough to show somebody
   * how many minutes they have, and it beats reporting zero.
   */
  const usable = dataBytes || Math.max(0, buffer.byteLength - offset - 8)

  return { channels, sampleRate, seconds: usable / bytesPerSecond }
}

/**
 * The same three facts from a FLAC STREAMINFO block.
 *
 * STREAMINFO is always the first metadata block and always 34 bytes, and the fields we want sit
 * in one 64-bit run: 20 bits of sample rate, 3 bits of channel count minus one, 5 bits of bit
 * depth minus one, then 36 bits of total sample count. They do not align to byte boundaries,
 * hence the shifting.
 */
export function readFlacFacts(buffer: ArrayBuffer): AudioFacts | null {
  const view = new DataView(buffer)
  if (buffer.byteLength < 42) return null

  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  )
  if (magic !== 'fLaC') return null

  // Byte 4 is the metadata block header; the low 7 bits are the type, and STREAMINFO is 0.
  if ((view.getUint8(4) & 0x7f) !== 0) return null

  // The block body starts at 8. Sample rate begins 10 bytes into it.
  const at = 8 + 10
  if (at + 8 > buffer.byteLength) return null

  const hi = view.getUint32(at, false)
  const lo = view.getUint32(at + 4, false)

  const sampleRate = hi >>> 12
  const channels = ((hi >>> 9) & 0x07) + 1

  // 36 bits of total samples: the low 4 bits of `hi`, then all 32 of `lo`.
  const totalSamples = (hi & 0x0f) * 2 ** 32 + lo

  if (!sampleRate) return null

  return { channels, sampleRate, seconds: totalSamples / sampleRate }
}

/** Whichever reader matches the file, or null when neither does. */
export function readAudioFacts(filename: string, buffer: ArrayBuffer): AudioFacts | null {
  return filename.toLowerCase().endsWith('.flac')
    ? readFlacFacts(buffer)
    : readWavFacts(buffer)
}

// ── What we tell somebody about the file they picked ──────────────────────────

/**
 * Why a file cannot be used, in words they can act on, or null when it is fine.
 *
 * `facts` is optional because AIFF is accepted and not parsed: refusing a format we said we
 * take, because we could not read its header, would be the check doing harm.
 */
export function describeVoiceRejection(
  file: { name: string; size: number },
  facts?: AudioFacts | null,
): string | null {
  if (!hasVoiceExtension(file.name)) {
    return `${file.name} is not a lossless file. Send FLAC, WAV or AIFF: an mp3 has already thrown away what the voice model needs to learn.`
  }
  if (file.size === 0) {
    return `${file.name} is empty.`
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    // Names the way out rather than just the limit. FLAC is about 45% smaller than the same
    // WAV and loses nothing, so for most files this is the whole fix.
    return `${file.name} is ${formatMegabytes(file.size)}, over the ${formatMegabytes(MAX_UPLOAD_BYTES)} limit per file. Export it as FLAC, or split it into shorter takes.`
  }
  if (facts && facts.channels > 1) {
    return `${file.name} is stereo. Bounce it to mono: the voice model only ever uses one channel, and stereo doubles the upload for nothing.`
  }
  return null
}

// ── The storage tier, and how close we are to filling it ──────────────────────

/**
 * The free plan's TOTAL storage, a single quota shared across every customer's uploads. This is
 * the ceiling the meter measures against, distinct from `MAX_UPLOAD_BYTES`, which is per file.
 */
export const FREE_STORAGE_BYTES = 1_000_000_000

/**
 * Roughly what one artist's training set costs on disk: 30 minutes of mono 48kHz/24-bit FLAC.
 *
 * Derived, not guessed. Uncompressed is `48000 * 3 * 60` bytes a minute, and FLAC lands vocals
 * at about 55% of that, so a minute is ~4.75MB and thirty minutes is ~142MB. It only drives the
 * "room for about N more artists" estimate, so an approximation is the honest precision here.
 */
export const TYPICAL_ARTIST_BYTES = Math.round(30 * 60 * 48000 * 3 * 0.55)

export type StorageSummary = {
  usedBytes: number
  /** 0 to 1 against the free tier, clamped. */
  fraction: number
  /** How many more typical artists fit in what is left. */
  artistsLeft: number
  /** True past ~85%, the point to start worrying rather than the point it breaks. */
  near: boolean
  /** The line the queue shows. */
  message: string
}

/**
 * Summarise how full the shared storage tier is, from a byte total summed out of the database.
 *
 * Summed from the stored `bytes` columns rather than the storage API, so it is one cheap query
 * and never opens a file. It understates slightly, because a retired voice's rows are gone while
 * a little metadata overhead is not counted, and understating the pressure is the safe direction
 * for a warning to err in only if it never lulls: hence `near` trips well before full.
 */
export function storageSummary(usedBytes: number): StorageSummary {
  const fraction = Math.min(1, usedBytes / FREE_STORAGE_BYTES)
  const remaining = Math.max(0, FREE_STORAGE_BYTES - usedBytes)
  const artistsLeft = Math.floor(remaining / TYPICAL_ARTIST_BYTES)
  const usedMb = Math.round(usedBytes / 1_000_000)

  return {
    usedBytes,
    fraction,
    artistsLeft,
    near: fraction >= 0.85,
    message: `${usedMb} MB of 1 GB used · room for about ${artistsLeft} more ${
      artistsLeft === 1 ? 'artist' : 'artists'
    } at 30 min mono FLAC`,
  }
}

// ── Presenting the total ──────────────────────────────────────────────────────

export function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`
}

/** "24 min 30 s", or "45 s" under a minute. The unit a person thinks in. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  if (!minutes) return `${rest} s`
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`
}

export type TrainingProgress = {
  seconds: number
  /** 0 to 1 against the MINIMUM, clamped, for a progress bar. */
  fraction: number
  enough: boolean
  /** What the page says under the bar. */
  message: string
}

/**
 * How far along a training set is.
 *
 * Measured against the twenty minute MINIMUM rather than the thirty minute target, because a
 * bar that reads 66% when the set is already usable tells somebody they are not finished when
 * they are. Past the minimum it says more is better, which is true, without demanding it.
 */
export function trainingProgress(seconds: number): TrainingProgress {
  const enough = seconds >= TRAINING_MINIMUM_SECONDS
  const fraction = Math.min(1, seconds / TRAINING_MINIMUM_SECONDS)

  if (seconds === 0) {
    return { seconds, fraction, enough, message: 'Aim for 20 to 30 minutes of clean vocal.' }
  }
  if (!enough) {
    const left = TRAINING_MINIMUM_SECONDS - seconds
    return {
      seconds,
      fraction,
      enough,
      message: `${formatDuration(left)} more to reach the 20 minute minimum.`,
    }
  }
  if (seconds < TRAINING_TARGET_SECONDS) {
    return {
      seconds,
      fraction,
      enough,
      message: 'Enough to train on. Closer to 30 minutes gives a better model.',
    }
  }
  return { seconds, fraction, enough, message: 'Plenty. More will not hurt.' }
}

/**
 * The object key for one sample.
 *
 * `{user}/{voice}/{n}{ext}` mirrors the submissions bucket exactly, because the storage policy
 * compares the FIRST PATH SEGMENT to `auth.uid()`. That shape is what stops one customer
 * reading another's training vocals, and changing it silently removes the protection.
 *
 * The uploader's filename is stored alongside for humans but never used in the key: a filename
 * can carry anything, and letting it decide a storage path is how traversal bugs happen.
 */
export function voiceSamplePath(
  userId: string,
  voiceId: string,
  index: number,
  filename: string,
): string {
  const dot = filename.lastIndexOf('.')
  const ext = dot > -1 ? filename.slice(dot).toLowerCase() : '.wav'
  return `${userId}/${voiceId}/sample-${index}${ext}`
}

/** The check the server repeats before trusting a path the client claims to have written. */
export function voicePathBelongsTo(path: string, userId: string, voiceId: string): boolean {
  return path.startsWith(`${userId}/${voiceId}/`) && !path.includes('..')
}
