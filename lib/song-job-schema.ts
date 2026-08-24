import { z } from 'zod'
import { LANGUAGE_CODES } from './languages'
import { isSubmittable } from './language-pairs'
import { MAX_LYRICS_CHARS } from './lyrics'

/**
 * What a portal submission has to contain before it is worth a human looking at it.
 *
 * Validated on the server as well as in the browser, for the usual reason: the upload goes
 * BROWSER DIRECT TO STORAGE, so by the time this runs the files already exist. A submission
 * that fails validation here has left objects behind, which is why `assetPaths` is checked
 * for shape rather than trusted, and why the route that consumes this is responsible for
 * cleaning up orphans.
 */

/** Storage kinds. `full_mix` is the fallback for somebody who has no stems to hand. */
export const ASSET_KINDS = ['instrumental', 'vocal', 'full_mix'] as const
export type AssetKind = (typeof ASSET_KINDS)[number]

const trimmed = (max: number) => z.string().trim().min(1).max(max)

/**
 * One uploaded file.
 *
 * `artistName` is optional and belongs to the file, not to the job. A track with a feature has
 * more than one vocal, and the person mixing needs to know whose is whose. Henry asked for the
 * name to sit next to the file for exactly that reason.
 *
 * `path` is the object key the browser already wrote to. It is checked against the caller's
 * own user id at the route, never trusted from the client, because a forged path is otherwise
 * a way to attach somebody else's upload to your own job.
 */
export const AssetSchema = z.object({
  kind: z.enum(ASSET_KINDS),
  artistName: z.string().trim().max(200).optional(),
  path: trimmed(500),
  filename: trimmed(300),
  bytes: z.number().int().positive().max(500 * 1024 * 1024),
})

export type AssetInput = z.infer<typeof AssetSchema>

export const SongJobSchema = z
  .object({
    title: trimmed(200),
    primaryArtist: trimmed(200),
    sourceLanguage: z.enum(LANGUAGE_CODES as [string, ...string[]]),
    targetLanguage: z.enum(LANGUAGE_CODES as [string, ...string[]]),
    assets: z.array(AssetSchema).min(1).max(12),
    notes: z.string().trim().max(2000).optional(),
    /**
     * The lyric sheet, in whatever language the song is in.
     *
     * Optional, and pushed hard rather than required: Henry's decision on 2026-08-12. The form
     * is already asking for an upload and a rights warranty, and this is the primary
     * conversion, so a third mandatory field costs submissions from anyone who does not have
     * the words to hand. The queue flags a job that arrived without them.
     *
     * No language check and no character-set check. Eight languages are offered, three of them
     * CJK, and a validator that assumes Latin script would silently refuse the ones this
     * product exists to serve.
     */
    lyrics: z.string().max(MAX_LYRICS_CHARS).optional(),
    /**
     * Not a checkbox for decoration. This is the statement that makes the eventual agreement
     * enforceable and keeps us out of an infringing release, so it is a literal `true` rather
     * than a boolean: an absent or false value is a failure, not a default.
     */
    rightsWarranty: z.literal(true),
  })
  .refine((v) => isSubmittable(v.sourceLanguage, v.targetLanguage), {
    path: ['targetLanguage'],
    message: 'Choose two different languages we work in.',
  })
  .refine(
    (v) => {
      const kinds = new Set(v.assets.map((a) => a.kind))
      // Stems preferred, full mix accepted. What is NOT acceptable is half a stem set, because
      // an instrumental with no vocal cannot be re-sung and a vocal with no instrumental has
      // nothing to sit over.
      return (kinds.has('instrumental') && kinds.has('vocal')) || kinds.has('full_mix')
    },
    {
      path: ['assets'],
      message:
        'Upload both an instrumental and a vocal, or a single full mix if you do not have stems.',
    },
  )

export type SongJobInput = z.infer<typeof SongJobSchema>

/** The lifecycle. Nothing processes until a human moves it off `submitted`. */
export const JOB_STATUSES = [
  'submitted',
  'approved',
  'in_progress',
  'delivered',
  'rejected',
] as const
export type JobStatus = (typeof JOB_STATUSES)[number]
