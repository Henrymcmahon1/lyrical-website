import { renderEmailHtml, renderEmailText, type EmailDoc } from './email-shell'
import { languageByCode } from './languages'
import { SITE_URL } from './site'

/**
 * `track-delivered`: the self-serve Door-2 job (the original, `reroll_index = 0`) just became
 * `delivered`. Fired by `app/api/hooks/song-job/route.ts` on that transition.
 *
 * Deliberately its own file, separate from `lib/song-job-email.ts`, which is the OLDER,
 * human-in-the-loop Door-1 funnel (a person accepts the job, a person delivers the files by
 * hand, and a rejection there sends nothing on Henry's instruction). This is the automated
 * self-serve path: the render PC delivers, there IS a player in the studio to point at, and a
 * rating is the entire point of the message.
 */

export const TURNAROUND_PROMISE = 'usually within 1 hour'
export const TURNAROUND_BUSY = 'up to 3 hours at busy times'

export type DeliveredEmailFields = {
  title: string
  /** The target language CODE, e.g. 'ES'. Resolved to its English name here, once. */
  targetLanguage: string
}

const languageName = (code: string) => languageByCode(code)?.english ?? code

function deliveredDoc(d: DeliveredEmailFields): EmailDoc {
  const language = languageName(d.targetLanguage)
  return {
    preheader: `The ${language} version of ${d.title} is ready. Have a listen and rate it.`,
    eyebrow: 'Delivered',
    heading: `${d.title} is ready.`,
    blocks: [
      {
        type: 'paragraph',
        text: `The ${language} version is in your studio now.`,
      },
      {
        type: 'paragraph',
        text: 'Personal use only. This is a beta output: rate it, and a rating is what lets you re-roll it if something is off.',
      },
      { type: 'cta', label: 'Listen and rate', href: `${SITE_URL}/studio` },
      {
        type: 'note',
        text: `Making another one? Tracks are ${TURNAROUND_PROMISE}, ${TURNAROUND_BUSY}.`,
      },
    ],
  }
}

export function deliveredSubject(d: DeliveredEmailFields): string {
  return `lyrical: ${d.title} is ready`
}

export function deliveredText(d: DeliveredEmailFields): string {
  return renderEmailText(deliveredDoc(d))
}

export function deliveredHtml(d: DeliveredEmailFields): string {
  return renderEmailHtml(deliveredDoc(d))
}
