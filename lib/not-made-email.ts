import { renderEmailHtml, renderEmailText, type EmailDoc } from './email-shell'
import { SITE_URL } from './site'

/**
 * `track-not-made`: a self-serve `song_jobs` row reached `status = 'rejected'` at OUR end (a
 * pipeline failure), not because of anything the customer did. Plain apology, it did not count,
 * make it again.
 *
 * Never carries `pipeline_error` or any other internal detail. Staff read the real reason in
 * `/queue`; the customer only needs to know it was not their fault and nothing was spent.
 */

export type NotMadeEmailFields = {
  title: string
}

function notMadeDoc(d: NotMadeEmailFields): EmailDoc {
  return {
    preheader: `${d.title} did not come out right on our end. It was not counted against your plan.`,
    eyebrow: 'Did not work out',
    heading: `${d.title} did not come out right.`,
    blocks: [
      {
        type: 'paragraph',
        text: 'Something went wrong on our end while making this one. We are sorry about that.',
      },
      {
        type: 'paragraph',
        text: 'It did not count. No track or credit was used, and nothing was charged.',
      },
      { type: 'cta', label: 'Make it again', href: `${SITE_URL}/studio/new` },
    ],
  }
}

export function notMadeSubject(d: NotMadeEmailFields): string {
  return `lyrical: ${d.title} did not come out right`
}

export function notMadeText(d: NotMadeEmailFields): string {
  return renderEmailText(notMadeDoc(d))
}

export function notMadeHtml(d: NotMadeEmailFields): string {
  return renderEmailHtml(notMadeDoc(d))
}
