import { renderEmailHtml, renderEmailText, type EmailDoc } from './email-shell'
import { SITE_URL } from './site'

/**
 * `reroll-delivered`: a CHILD `song_jobs` row (`reroll_index > 0`) just became `delivered`.
 * "Take N is ready", where N is `reroll_index + 1` because the original is Take 1.
 *
 * A re-roll only ever exists because a thumbs-down with a note was saved on the row it re-rolls
 * (`app/studio/reroll-actions.ts`, spec §6), so this message never asks for a fresh rating in
 * the way `delivered-email.ts` does: the loop has already run once for this track.
 */

export type RerollDeliveredEmailFields = {
  title: string
  /** `song_jobs.reroll_index` on the child that was just delivered (1 or 2). */
  rerollIndex: number
  /** How many more re-rolls this family has left, after this one. */
  rerollsRemaining: number
}

const takeLabel = (rerollIndex: number) => `Take ${rerollIndex + 1}`

function remainingLine(rerollsRemaining: number): string {
  if (rerollsRemaining <= 0) {
    return 'You have used both re-rolls on this track.'
  }
  const noun = rerollsRemaining === 1 ? 're-roll' : 're-rolls'
  return `You have ${rerollsRemaining} ${noun} left on this track, if you want another pass.`
}

function rerollDeliveredDoc(d: RerollDeliveredEmailFields): EmailDoc {
  const take = takeLabel(d.rerollIndex)
  return {
    preheader: `${take} of ${d.title} is ready to listen to.`,
    eyebrow: 'Delivered',
    heading: `${take} of ${d.title} is ready.`,
    blocks: [
      {
        type: 'paragraph',
        text: `${take} is in your studio now, alongside the original.`,
      },
      { type: 'paragraph', text: remainingLine(d.rerollsRemaining) },
      { type: 'cta', label: 'Listen', href: `${SITE_URL}/studio` },
    ],
  }
}

export function rerollDeliveredSubject(d: RerollDeliveredEmailFields): string {
  return `lyrical: ${takeLabel(d.rerollIndex)} of ${d.title} is ready`
}

export function rerollDeliveredText(d: RerollDeliveredEmailFields): string {
  return renderEmailText(rerollDeliveredDoc(d))
}

export function rerollDeliveredHtml(d: RerollDeliveredEmailFields): string {
  return renderEmailHtml(rerollDeliveredDoc(d))
}
