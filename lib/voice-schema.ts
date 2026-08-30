import { z } from 'zod'
import { MAX_UPLOAD_BYTES, TRAINING_MINIMUM_SECONDS } from './voice-training'

/**
 * What a voice-model submission has to contain before a human should look at it.
 *
 * Validated on the server as well as in the browser, for the same reason the song schema is:
 * the upload goes BROWSER DIRECT TO STORAGE, so by the time this runs the objects already
 * exist and the client is telling us where it put them. Every path is re-checked against the
 * caller's own user id at the action.
 */

const trimmed = (max: number) => z.string().trim().min(1).max(max)

export const VoiceSampleSchema = z.object({
  path: trimmed(500),
  filename: trimmed(300),
  bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  /**
   * Read from the file's own header in the browser.
   *
   * Nullable rather than required because AIFF headers are not parsed, and a set that is mostly
   * FLAC with one AIFF in it should still submit. An unknown duration counts as zero toward the
   * total, which understates rather than overstates how much training audio there is.
   */
  seconds: z.number().nonnegative().max(3 * 3600).nullable(),
})

export type VoiceSampleInput = z.infer<typeof VoiceSampleSchema>

export const VoiceSubmitSchema = z.object({
  voiceId: z.string().regex(/^[0-9a-f-]{36}$/i),
  artistName: trimmed(200),
  notes: z.string().trim().max(2000).optional(),
  /**
   * Not a checkbox for decoration, and deliberately separate from the per-song rights warranty.
   *
   * Handing over thirty minutes of an artist's isolated vocal so a model can be built from it
   * is a materially bigger permission than sending one song to be re-sung. `z.literal(true)`
   * rather than a boolean: absent or false is a failure, never a default.
   */
  consent: z.literal(true),
  /**
   * A training set is many files by construction. The free plan caps a single object at 50MB,
   * so twenty to thirty minutes arrives as roughly eight to twelve takes. Sixty is a generous
   * ceiling that still stops a runaway loop writing thousands of rows.
   */
  samples: z.array(VoiceSampleSchema).min(1).max(60),
})

export type VoiceSubmitInput = z.infer<typeof VoiceSubmitSchema>

/**
 * Adding takes to a voice that already exists.
 *
 * No artist name and no consent, because both were given when the voice was created: this only
 * appends more clean vocal to a set still being collected. The action re-checks ownership and
 * that the voice is still `collecting`, so a voice already in training cannot be added to.
 */
export const VoiceTakesSchema = z.object({
  voiceId: z.string().regex(/^[0-9a-f-]{36}$/i),
  samples: z.array(VoiceSampleSchema).min(1).max(60),
})

export type VoiceTakesInput = z.infer<typeof VoiceTakesSchema>

/** Total training audio in a set, treating an unreadable header as zero. */
export function totalSeconds(samples: { seconds: number | null }[]): number {
  return samples.reduce((sum, s) => sum + (s.seconds ?? 0), 0)
}

/**
 * Whether a set is long enough to train on.
 *
 * NOT enforced at submit. Somebody who has fifteen minutes today and more next week should be
 * able to send what they have rather than being blocked by a form, so this decides what the
 * queue SHOWS a human, not what the server accepts. Refusing here would lose the upload they
 * already sat through.
 */
export function isTrainable(samples: { seconds: number | null }[]): boolean {
  return totalSeconds(samples) >= TRAINING_MINIMUM_SECONDS
}

/**
 * The lifecycle. Nothing trains until a human moves it off `collecting`.
 *
 * `retired` is customer-set, not staff-set: retiring a voice purges its training files to free
 * storage and keeps the row, so the consent record survives. It is terminal.
 */
export const VOICE_STATUSES = [
  'collecting',
  'approved',
  'training',
  'ready',
  'rejected',
  'retired',
] as const
export type VoiceStatus = (typeof VOICE_STATUSES)[number]
