import { CONTACT_EMAIL } from './enquiry-email'
import { TURNAROUND_HOURS, isGuaranteed } from './language-pairs'
import { languageByCode } from './languages'
import type { LanguageCode } from './languages'

/**
 * The two emails a submission sends.
 *
 * Kept separate from `enquiry-email.ts` on purpose. They look similar and they are not: an
 * enquiry is a stranger asking a question, and this is a customer who has just handed over an
 * unreleased master. The obligations differ, so the wording differs, and folding them together
 * would mean one change to a shared template quietly rewording the other.
 *
 * ⚠️ NO FILE CONTENT, NO SIGNED URLS, AND NO STORAGE PATHS APPEAR IN EITHER EMAIL. Email is
 * forwarded, archived and searched by systems nobody here controls. Staff open the job in the
 * queue, behind the admin session, and the customer already knows what they sent.
 */

export type SongJobEmailFields = {
  title: string
  primaryArtist: string
  sourceLanguage: string
  targetLanguage: string
  fileCount: number
  featureNames: string[]
  notes?: string
  submitterEmail: string
}

const languageName = (code: string) =>
  languageByCode(code)?.english ?? code

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const CREAM = '#F7EFE1'
const GRAPHITE = '#1C1A19'
const INDIGO = '#4433D6'

const pair = (d: SongJobEmailFields) =>
  `${languageName(d.sourceLanguage)} to ${languageName(d.targetLanguage)}`

/**
 * What the customer is told about timing.
 *
 * The clock starts at ACCEPTANCE, not at submission, on Henry's instruction, because a human
 * approves every job and a Friday evening submission would otherwise start a promise burning
 * while nobody is looking at it. An unguaranteed pair names no figure at all rather than
 * quietly implying the same one.
 */
export function timingLine(source: string, target: string): string {
  return isGuaranteed(source as LanguageCode, target as LanguageCode)
    ? `Once we accept it, you will have it within ${TURNAROUND_HOURS} hours.`
    : 'We will confirm timing when we accept it.'
}

// ── To the founders ───────────────────────────────────────────────────────────

export function jobNotificationSubject(d: SongJobEmailFields): string {
  return `New song: ${d.title} (${d.primaryArtist}), ${pair(d)}`
}

export function jobNotificationText(d: SongJobEmailFields): string {
  const lines = [
    `${d.title} — ${d.primaryArtist}`,
    `${pair(d)}`,
    '',
    `From:      ${d.submitterEmail}`,
    `Files:     ${d.fileCount}`,
  ]
  if (d.featureNames.length) lines.push(`Features:  ${d.featureNames.join(', ')}`)
  if (d.notes) lines.push('', 'Notes:', d.notes)
  lines.push(
    '',
    'Nothing is processed until one of you accepts it in the queue.',
    'The files are not attached and are not linked. Open the job to hear them.',
  )
  return lines.join('\n')
}

export function jobNotificationHtml(d: SongJobEmailFields): string {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 16px 6px 0;color:${GRAPHITE};opacity:.6;font-size:14px;">${esc(k)}</td>` +
    `<td style="padding:6px 0;color:${GRAPHITE};font-size:14px;">${esc(v)}</td></tr>`

  return `<div style="background:${CREAM};padding:32px;font-family:Helvetica,Arial,sans-serif;">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GRAPHITE};opacity:.5;">New submission</p>
  <p style="margin:0 0 20px;font-family:Georgia,serif;font-size:24px;color:${GRAPHITE};">${esc(d.title)}</p>
  <table style="border-collapse:collapse;">
    ${row('Artist', d.primaryArtist)}
    ${row('Language', pair(d))}
    ${row('From', d.submitterEmail)}
    ${row('Files', String(d.fileCount))}
    ${d.featureNames.length ? row('Features', d.featureNames.join(', ')) : ''}
  </table>
  ${d.notes ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${GRAPHITE};">${esc(d.notes)}</p>` : ''}
  <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${GRAPHITE};opacity:.65;">
    Nothing is processed until one of you accepts it. The files are neither attached nor linked here: open the job in the queue.
  </p>
</div>`
}

// ── To the person who sent it ─────────────────────────────────────────────────

export function jobConfirmationSubject(d: SongJobEmailFields): string {
  return `lyrical: we have ${d.title}`
}

export function jobConfirmationText(d: SongJobEmailFields): string {
  return [
    `We have ${d.title}, and the files arrived intact.`,
    '',
    `You asked for ${pair(d)}.`,
    '',
    timingLine(d.sourceLanguage, d.targetLanguage),
    '',
    'Nothing is made until we accept it, and nothing is released without your approval.',
    'There is no cost for finding out what it sounds like.',
    '',
    `Any questions, reply to this message or write to ${CONTACT_EMAIL}.`,
    '',
    'lyrical',
  ].join('\n')
}

export function jobConfirmationHtml(d: SongJobEmailFields): string {
  return `<div style="background:${CREAM};padding:32px;font-family:Helvetica,Arial,sans-serif;">
  <p style="margin:0 0 18px;font-family:Georgia,serif;font-size:24px;color:${GRAPHITE};">We have ${esc(d.title)}.</p>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${GRAPHITE};">
    The files arrived intact. You asked for <strong>${esc(pair(d))}</strong>.
  </p>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${GRAPHITE};">
    ${esc(timingLine(d.sourceLanguage, d.targetLanguage))}
  </p>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${GRAPHITE};">
    Nothing is made until we accept it, and nothing is released without your approval. There is no cost for finding out what it sounds like.
  </p>
  <p style="margin:22px 0 0;font-size:14px;color:${GRAPHITE};opacity:.7;">
    Questions? Reply here, or write to <a href="mailto:${CONTACT_EMAIL}" style="color:${INDIGO};">${CONTACT_EMAIL}</a>.
  </p>
  <p style="margin:20px 0 0;font-family:Georgia,serif;font-size:15px;color:${GRAPHITE};">lyrical</p>
</div>`
}
