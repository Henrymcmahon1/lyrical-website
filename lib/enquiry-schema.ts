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

/**
 * The "send me examples" overlay. It asks for an email and the languages, nothing else.
 *
 * A visitor who wants to hear a sample is browsing, not buying, and a seven-field form is a
 * contract-sized ask for a browsing-sized intention. The name is collected in the reply
 * instead. The full enquiry form still requires it: by then somebody is asking to be
 * contacted, and a reply needs a person to address.
 */
export const GATE_SOURCE = 'gate'

/** Written into the name column when the gate did not collect one. */
export const NAME_NOT_GIVEN = 'Not given'

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(''))

export const EnquirySchema = z.object({
  // Conditionally required. See the superRefine below, and GATE_SOURCE above for why.
  name: optionalText(120),
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
}).superRefine((value, ctx) => {
  const given = value.name?.trim() ?? ''

  if (given.length === 0) {
    // Absent is fine for the examples gate and nowhere else.
    if (value.source !== GATE_SOURCE) {
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'Please tell us your name' })
    }
    return
  }

  // If a name WAS typed, it has to be a plausible one at either entry point. A single
  // character is a half-finished field, not a shorter answer.
  if (given.length < 2) {
    ctx.addIssue({ code: 'custom', path: ['name'], message: 'Please tell us your name' })
  }
})

export type EnquiryInput = z.infer<typeof EnquirySchema>

/** The name to record, given the gate may not have asked for one. */
export function resolveName(input: Pick<EnquiryInput, 'name'>): string {
  return input.name?.trim() || NAME_NOT_GIVEN
}
