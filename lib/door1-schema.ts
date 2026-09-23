import { z } from 'zod'
import { isSubmittable } from './language-pairs'
import { LANGUAGE_CODES, languageByCode } from './languages'
import { MAX_LYRICS_CHARS } from './lyrics'
import { MAX_BYTES } from './song-upload'

/**
 * Door 1: the staff-made artist line, created at `/admin/door1/new`.
 *
 * Pure: no I/O, no framework. The form validation, the insert shape and the small labels the
 * console shares all live here so they are unit-tested on their own. The shape of the row is
 * THE CONTRACT in `docs/bots/door1/README.md`, read by the render PC poller (lyrical-studio,
 * `dashboard/service/website/mapper.py`); change it there first or not at all.
 */

export const DOOR1 = 'door1' as const

/** The private bucket the poller uploads the three FLACs to, at `{job_id}/{kind}.flac`. */
export const DOOR1_BUCKET = 'door1'

/** What the poller delivers, in the order the console lists them. */
export const DOOR1_DELIVERY_KINDS = ['vocal', 'instrumental', 'mix'] as const
export type Door1DeliveryKind = (typeof DOOR1_DELIVERY_KINDS)[number]

export const DOOR1_KIND_LABEL: Record<Door1DeliveryKind, string> = {
  vocal: 'Vocal',
  instrumental: 'Instrumental',
  mix: 'Mix',
}

export const DOOR1_FORMAT_LABEL = '24-bit FLAC (lossless)'

/** Seconds a download link lives. Minted per click, after `requireAdmin()`. */
export const DOOR1_SIGNED_URL_TTL_S = 60

/**
 * Targets the pipeline has no language pack for. The site offers nine languages but the
 * translate stage has packs for eight (lyrical-studio `lyrical/translate/knowledge/packs/
 * languages`): Japanese has none, and a JA job fails loud on the render PC. Refused here so
 * nobody queues a job that cannot run. Remove `JA` when the pack lands.
 */
export const NO_PACK_TARGETS: readonly string[] = ['JA']

/**
 * Door 1 source uploads. MP3 is accepted here, unlike Door 2: the staff know what they are
 * handing over, and a Qobuz link is the lossless route when the file is not.
 */
export const DOOR1_UPLOAD_EXTENSIONS = ['.mp3', '.flac', '.wav'] as const
export const DOOR1_ACCEPT_ATTRIBUTE = DOOR1_UPLOAD_EXTENSIONS.join(',')

/** Supabase free plan's fixed per-object cap. Same constant Door 2 uses. */
export const DOOR1_MAX_BYTES = MAX_BYTES

const OVER_CAP_MESSAGE = 'That file is over 50 MB, the storage limit: use FLAC or a Qobuz link.'

export function hasDoor1Extension(filename: string): boolean {
  const lower = filename.toLowerCase()
  return DOOR1_UPLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** The client-side check before a byte is uploaded. Null when the file is fine. */
export function describeDoor1FileRejection(file: { name: string; size: number }): string | null {
  if (!hasDoor1Extension(file.name)) return `${file.name} is not an MP3, FLAC or WAV file.`
  if (file.size === 0) return `${file.name} is empty.`
  if (file.size > DOOR1_MAX_BYTES) return `${file.name}: ${OVER_CAP_MESSAGE}`
  return null
}

/** An https link on qobuz.com or one of its subdomains. Nothing else. */
export function isQobuzUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  return host === 'qobuz.com' || host.endsWith('.qobuz.com')
}

export type RestoreMode = 'cascade' | 'zeroshot'

/** Cascade (trained voice, Seed-VC then RVC) with a voice; zero-shot without. */
export function defaultRestoreMode(voiceModel: string | undefined): RestoreMode {
  return voiceModel ? 'cascade' : 'zeroshot'
}

/** Door 1 rows by either marker. The poller requires both; the website excludes on either. */
export function isDoor1(row: { delivery_profile?: string | null; route?: string | null }): boolean {
  return row.delivery_profile === DOOR1 || row.route === DOOR1
}

/** `''` and whitespace become `undefined`, so an empty form field reads as "not given". */
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(blankToUndefined, schema.optional())

const trimmed = (max: number) => z.string().trim().min(1).max(max)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export const Door1AssetSchema = z.object({
  path: trimmed(500),
  filename: trimmed(300),
  bytes: z.number().int().positive(),
})

const LANG = z.enum(LANGUAGE_CODES as [string, ...string[]])

export const Door1JobSchema = z
  .object({
    /** Minted by the server with the upload ticket, or by the form for a Qobuz job. */
    jobId: z.string().regex(UUID, 'That form looks malformed. Reload and try again.'),
    enquiryId: optional(z.string().regex(UUID, 'Pick the artist from the list again.')),
    primaryArtist: trimmed(200),
    title: trimmed(200),
    sourceLanguage: LANG,
    targetLanguage: LANG,
    /**
     * The render PC voice model name (a Modal voice, e.g. `Coffey_Anderson`), or absent for
     * zero-shot. Not checked against a list here: the poller asks Modal and fails loud on an
     * unknown name. Characters are restricted so a name can never be a path.
     */
    voiceModel: optional(
      z
        .string()
        .trim()
        .max(100)
        .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/, 'A voice model name is letters, digits, _ . and - only.'),
    ),
    /** Reference only: in `known` mode the pipeline transcribes the source itself today. */
    lyrics: optional(z.string().max(MAX_LYRICS_CHARS)),
    notes: optional(z.string().trim().max(4000)),
    dueOn: optional(z.string().refine(isRealDate, 'Pick a real due date.')),
    vocalDenoise: z.boolean().default(true),
    restoreMode: optional(z.enum(['cascade', 'zeroshot'])),
    sourceUrl: optional(z.string().trim().max(1000)),
    asset: Door1AssetSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (!isSubmittable(v.sourceLanguage, v.targetLanguage)) {
      ctx.addIssue({ code: 'custom', path: ['targetLanguage'], message: 'Choose two different languages we work in.' })
    } else if (NO_PACK_TARGETS.includes(v.targetLanguage)) {
      const name = languageByCode(v.targetLanguage)?.english ?? v.targetLanguage
      ctx.addIssue({
        code: 'custom',
        path: ['targetLanguage'],
        message: `The pipeline cannot sing into ${name} yet: it has no ${name} language pack. Pick another target.`,
      })
    }

    const hasUrl = Boolean(v.sourceUrl)
    const hasAsset = Boolean(v.asset)
    if (hasUrl === hasAsset) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceUrl'],
        message: 'Give exactly one source: upload the full mix OR paste a Qobuz link.',
      })
    } else if (v.sourceUrl && !isQobuzUrl(v.sourceUrl)) {
      ctx.addIssue({ code: 'custom', path: ['sourceUrl'], message: 'That is not a Qobuz link (https://...qobuz.com/...).' })
    }
    if (v.asset) {
      if (!hasDoor1Extension(v.asset.filename)) {
        ctx.addIssue({ code: 'custom', path: ['asset'], message: 'The full mix must be an MP3, FLAC or WAV file.' })
      }
      if (v.asset.bytes > DOOR1_MAX_BYTES) {
        ctx.addIssue({ code: 'custom', path: ['asset'], message: OVER_CAP_MESSAGE })
      }
    }

    if (v.restoreMode === 'cascade' && !v.voiceModel) {
      ctx.addIssue({
        code: 'custom',
        path: ['restoreMode'],
        message: 'Cascade needs a voice model. Name one, or choose zero-shot.',
      })
    }
  })

export type Door1JobInput = z.infer<typeof Door1JobSchema>

export type Door1Settings = { vocal_denoise: boolean; restore_mode: RestoreMode }

export function door1Settings(input: Door1JobInput): Door1Settings {
  return {
    vocal_denoise: input.vocalDenoise,
    restore_mode: input.restoreMode ?? defaultRestoreMode(input.voiceModel),
  }
}

/**
 * THE Door 1 `song_jobs` insert (README contract, "A Door 1 row"). Same shape as the Door 2
 * self-serve insert in `app/studio/self-serve-actions.ts`, with the Door 1 differences:
 * route and profile `door1`, NO quota stamp ever, no licence or rights terms (the artist's
 * signed agreement covers it), and the staff-only `door1_*` columns.
 */
export function door1JobRow(input: Door1JobInput, ctx: { userId: string; nowIso: string }) {
  return {
    id: input.jobId,
    user_id: ctx.userId,
    delivery_profile: DOOR1,
    route: DOOR1,
    status: 'approved',
    approved_at: ctx.nowIso,
    pipeline_state: 'queued',
    quota_consumed_at: null,
    title: input.title,
    primary_artist: input.primaryArtist,
    source_language: input.sourceLanguage,
    target_language: input.targetLanguage,
    lyrics: input.lyrics ?? null,
    notes: input.notes ?? null,
    pipeline_voice_model: input.voiceModel ?? null,
    door1_enquiry_id: input.enquiryId ?? null,
    door1_due_on: input.dueOn ?? null,
    door1_source_url: input.sourceUrl ?? null,
    door1_settings: door1Settings(input),
    rights_terms_version: null,
    licence_terms_version: null,
  }
}

/** The one `full_mix` asset row for an uploaded source, or null for a Qobuz job. */
export function door1AssetRow(input: Door1JobInput, userId: string) {
  if (!input.asset) return null
  return {
    job_id: input.jobId,
    user_id: userId,
    kind: 'full_mix' as const,
    path: input.asset.path,
    filename: input.asset.filename,
    bytes: input.asset.bytes,
  }
}
