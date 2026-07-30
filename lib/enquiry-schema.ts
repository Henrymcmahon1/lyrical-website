import { z } from 'zod'
import { LANGUAGE_CODES } from './languages'

export const ROLES = [
  'artist',
  'manager',
  'label',
  'publisher',
  'distributor',
  'other',
] as const

export const CATALOGUE_SIZES = ['1', '2-10', '11-100', '100+', 'unsure'] as const

/** Minimum time a human takes to fill this form. Anything faster is a bot. */
export const MIN_ELAPSED_MS = 2000

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(''))

export const EnquirySchema = z.object({
  name: z.string().trim().min(2, 'Please tell us your name').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('That email address doesn’t look right'),
  role: z.enum(ROLES),
  company: optionalText(160),
  catalogue_size: z.enum(CATALOGUE_SIZES).optional(),
  target_languages: z
    .array(z.string().refine((c) => LANGUAGE_CODES.includes(c), 'Unknown language'))
    .max(8)
    .optional(),
  message: optionalText(4000),
  source: z.string().trim().max(60),
  unlocked_audio: z.boolean().default(false),

  // Anti-spam. `website` is a honeypot and must stay empty.
  website: z.literal('').optional(),
  elapsed_ms: z.coerce.number().int().nonnegative(),
})

export type EnquiryInput = z.infer<typeof EnquirySchema>
