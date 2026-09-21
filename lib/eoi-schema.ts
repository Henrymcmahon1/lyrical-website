import { z } from 'zod'
import { CATALOGUE_SIZES } from './enquiry-schema'
import { LANGUAGE_CODES } from './languages'

/**
 * The artist expression of interest: an enquiry with three extra answers, stored as one.
 *
 * `enquiries` has no artist columns and this round adds none. `toEnquiry` folds the extras
 * into `message` as labelled lines (readable in the inbox and in /queue?tab=enquiries) and
 * puts the act's name in `company`, which that tab already shows.
 */
export const ARTIST_EOI_SOURCE = 'artist_eoi'
export const EOI_ROLES = ['artist', 'manager', 'label', 'other'] as const
export const STREAM_BANDS = ['<10k', '10k-100k', '100k-1m', '1m+'] as const
export const STREAM_BAND_LABELS: Record<(typeof STREAM_BANDS)[number], string> = {
  '<10k': 'under 10k',
  '10k-100k': '10k to 100k',
  '100k-1m': '100k to 1m',
  '1m+': '1m or more',
}
export const MAX_LINKS = 3

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))
const blankToUndefined = (v: unknown) => (v === '' || v == null ? undefined : v)

/** A textarea gives one string, one per line; the JSON path may give an array. Both become a clean array. */
const linksToArray = (v: unknown): string[] => {
  const raw = Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(/[\r\n,\s]+/) : []
  return raw.map((s) => s.trim()).filter(Boolean)
}

export const EoiSchema = z.object({
  name: z.string().trim().min(2, 'Please tell us your name').max(120),
  artistName: z.string().trim().min(1, 'Please tell us the artist or act').max(160),
  email: z.string().trim().toLowerCase().email('That email address does not look right'),
  role: z.preprocess((v) => (v === '' || v == null ? 'other' : v), z.enum(EOI_ROLES)),
  catalogue_size: z.preprocess(blankToUndefined, z.enum(CATALOGUE_SIZES).optional()),
  monthlyStreamsBand: z.enum(STREAM_BANDS, { message: 'Pick a monthly streams band' }),
  target_languages: z
    .array(z.string().refine((c) => LANGUAGE_CODES.includes(c), 'Unknown language'))
    .max(8)
    .optional(),
  links: z.preprocess(
    linksToArray,
    z
      .array(
        z
          .string()
          .max(300)
          .url()
          .refine((u) => /^https?:\/\//i.test(u), 'Links must start with http'),
      )
      .max(MAX_LINKS, `Up to ${MAX_LINKS} links`),
  ),
  message: optionalText(3000),
})
export type EoiInput = z.infer<typeof EoiSchema>

/** Exactly the fields `EnquirySchema` validates, minus the anti-spam ones the caller adds. */
export type EnquiryPayload = {
  name: string
  email: string
  role: (typeof EOI_ROLES)[number]
  company: string
  catalogue_size: string
  target_languages: string[]
  message: string
  source: typeof ARTIST_EOI_SOURCE
  unlocked_audio: false
}

export function toEnquiry(d: EoiInput): EnquiryPayload {
  const lines = [
    `Artist or act: ${d.artistName}`,
    `Monthly streams: ${STREAM_BAND_LABELS[d.monthlyStreamsBand]}`,
    `Links: ${d.links.length ? d.links.join(' | ') : '-'}`,
  ]
  const free = d.message?.trim() ?? ''
  return {
    name: d.name,
    email: d.email,
    role: d.role,
    company: d.artistName,
    catalogue_size: d.catalogue_size ?? '',
    target_languages: d.target_languages ?? [],
    message: free ? `${lines.join('\n')}\n\n${free}` : lines.join('\n'),
    source: ARTIST_EOI_SOURCE,
    unlocked_audio: false,
  }
}
