import { renderEmailHtml, renderEmailText, type EmailDoc } from './email-shell'
import { TURNAROUND_HOURS, isGuaranteed } from './language-pairs'
import { languageByCode } from './languages'
import type { LanguageCode } from './languages'
import { SITE_URL } from './site'

/**
 * Every email a song job sends, across its whole life.
 *
 * Four of them now: a notification to the founders when one arrives, a confirmation to the
 * person who sent it, an acceptance when a human takes it on, and a delivery when it is
 * finished. A rejection sends NOTHING, deliberately, on Henry's instruction. That decision is
 * respected here and paid for in `components/JobStatus.tsx`, which no longer tells a rejected
 * customer they have been contacted, because they have not been.
 *
 * Kept separate from `enquiry-email.ts` on purpose. They look similar and they are not: an
 * enquiry is a stranger asking a question, and this is a customer who has just handed over an
 * unreleased master. The obligations differ, so the wording differs, and folding them together
 * would mean one change to a shared template quietly rewording the other. What they DO share
 * is `email-shell.ts`, which owns the look and nothing else.
 *
 * ⚠️ NO FILE CONTENT, NO SIGNED URLS, AND NO STORAGE PATHS APPEAR IN ANY OF THEM. Email is
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

const languageName = (code: string) => languageByCode(code)?.english ?? code

const pair = (d: SongJobEmailFields) =>
  `${languageName(d.sourceLanguage)} to ${languageName(d.targetLanguage)}`

/**
 * What the customer is told about timing BEFORE a human has looked at the job.
 *
 * The clock starts at ACCEPTANCE, not at submission, on Henry's instruction, because a human
 * approves every job and a Friday evening submission would otherwise start a promise burning
 * while nobody is looking at it. An unguaranteed pair names no figure at all rather than
 * quietly implying the same one.
 *
 * Since 2026-08-11 every offered pair is guaranteed, so in practice this always names the
 * figure. The other branch is kept because narrowing the promise must not require rewriting
 * the sentence that says so. See `lib/language-pairs.ts`.
 */
export function timingLine(source: string, target: string): string {
  return isGuaranteed(source as LanguageCode, target as LanguageCode)
    ? `Once we accept it, you will have it within ${TURNAROUND_HOURS} hours.`
    : 'We will confirm timing when we accept it.'
}

/**
 * The same promise, said AFTER acceptance, when the clock is actually running.
 *
 * A separate sentence rather than a reused one. "Once we accept it, you will have it within 48
 * hours" arriving in an email whose subject is "we have taken it on" reads as though nothing
 * has happened yet, which is the opposite of what that message exists to say.
 */
export function acceptedTimingLine(source: string, target: string): string {
  return isGuaranteed(source as LanguageCode, target as LanguageCode)
    ? `The clock starts now: you will have it within ${TURNAROUND_HOURS} hours.`
    : 'We will come back to you shortly with timing.'
}

// ── To the founders, when a song arrives ──────────────────────────────────────

export function jobNotificationSubject(d: SongJobEmailFields): string {
  return `New song: ${d.title} (${d.primaryArtist}), ${pair(d)}`
}

function notificationDoc(d: SongJobEmailFields): EmailDoc {
  const rows: [string, string][] = [
    ['Artist', d.primaryArtist],
    ['Language', pair(d)],
    ['From', d.submitterEmail],
    ['Files', String(d.fileCount)],
  ]
  if (d.featureNames.length) rows.push(['Features', d.featureNames.join(', ')])

  const blocks: EmailDoc['blocks'] = [{ type: 'rows', rows }]
  if (d.notes) blocks.push({ type: 'paragraph', text: d.notes })
  blocks.push(
    { type: 'cta', label: 'Open the queue', href: `${SITE_URL}/queue` },
    {
      type: 'note',
      text:
        'Nothing is processed until one of you accepts it, and accepting starts the delivery ' +
        'clock. The files are neither attached nor linked here: open the job in the queue.',
    },
  )

  return {
    preheader: `${d.title} by ${d.primaryArtist}, ${pair(d)}. Waiting on one of you to accept it.`,
    eyebrow: 'New submission',
    heading: d.title,
    blocks,
  }
}

export function jobNotificationText(d: SongJobEmailFields): string {
  return renderEmailText(notificationDoc(d))
}

export function jobNotificationHtml(d: SongJobEmailFields): string {
  return renderEmailHtml(notificationDoc(d))
}

// ── To the person who sent it ─────────────────────────────────────────────────

export function jobConfirmationSubject(d: SongJobEmailFields): string {
  return `lyrical: we have ${d.title}`
}

function confirmationDoc(d: SongJobEmailFields): EmailDoc {
  return {
    preheader: `${d.title} arrived intact. Nothing is made until we accept it.`,
    heading: `We have ${d.title}.`,
    blocks: [
      {
        type: 'paragraph',
        text: `The files arrived intact, and you asked for ${pair(d)}.`,
      },
      { type: 'paragraph', text: timingLine(d.sourceLanguage, d.targetLanguage) },
      {
        type: 'paragraph',
        text:
          'Nothing is made until we accept it, and nothing is released without your approval. ' +
          'There is no upfront cost for finding out what it sounds like.',
      },
      { type: 'cta', label: 'See where it is', href: `${SITE_URL}/studio` },
    ],
  }
}

export function jobConfirmationText(d: SongJobEmailFields): string {
  return renderEmailText(confirmationDoc(d))
}

export function jobConfirmationHtml(d: SongJobEmailFields): string {
  return renderEmailHtml(confirmationDoc(d))
}

// ── When a human takes it on ──────────────────────────────────────────────────

export function jobAcceptedSubject(d: SongJobEmailFields): string {
  return `lyrical: we have taken on ${d.title}`
}

function acceptedDoc(d: SongJobEmailFields): EmailDoc {
  return {
    preheader: `${d.title} is in the studio. ${acceptedTimingLine(d.sourceLanguage, d.targetLanguage)}`,
    eyebrow: 'Accepted',
    heading: `We have taken on ${d.title}.`,
    blocks: [
      {
        type: 'paragraph',
        text: `It is in the studio now, going from ${pair(d)}.`,
      },
      {
        type: 'paragraph',
        text: acceptedTimingLine(d.sourceLanguage, d.targetLanguage),
      },
      {
        type: 'paragraph',
        text:
          'You will hear it before anyone else does. Nothing is released without your ' +
          'approval, and you sign only after you have heard it.',
      },
      { type: 'cta', label: 'Follow it in the studio', href: `${SITE_URL}/studio` },
    ],
  }
}

export function jobAcceptedText(d: SongJobEmailFields): string {
  return renderEmailText(acceptedDoc(d))
}

export function jobAcceptedHtml(d: SongJobEmailFields): string {
  return renderEmailHtml(acceptedDoc(d))
}

// ── When it is finished ───────────────────────────────────────────────────────

export function jobDeliveredSubject(d: SongJobEmailFields): string {
  return `lyrical: ${d.title} is ready`
}

/**
 * Delivery says the work is done and that the files are coming SEPARATELY.
 *
 * It does not offer a link, and it does not tell anyone to go and press play, because there is
 * nowhere to press play. There is no delivery bucket, no player in the studio and no signed
 * URL that would be safe to put in an inbox anyway. Henry's call on 2026-08-11 was status plus
 * email for now, with the audio going across by hand.
 *
 * That constraint is worth writing down rather than working around. The site already promised
 * playback once on `/hear` and could not deliver it, and this is the same trap one layer
 * deeper: an email that says "listen here" pointing at a page that cannot is worse than one
 * that says a person is about to send you something.
 */
function deliveredDoc(d: SongJobEmailFields): EmailDoc {
  return {
    preheader: `The ${languageName(d.targetLanguage)} version of ${d.title} is finished.`,
    eyebrow: 'Delivered',
    heading: `${d.title} is ready.`,
    blocks: [
      {
        type: 'paragraph',
        text: `The ${languageName(d.targetLanguage)} version is finished, sung in ${d.primaryArtist}'s own voice over your original backing.`,
      },
      {
        type: 'paragraph',
        text:
          'We are sending the files across to you directly, so keep an eye on this thread. ' +
          'Reply here if anything has not reached you.',
      },
      {
        type: 'paragraph',
        text:
          'Nothing is released until you approve it. Have a listen, and tell us what you ' +
          'think before you decide anything.',
      },
    ],
  }
}

export function jobDeliveredText(d: SongJobEmailFields): string {
  return renderEmailText(deliveredDoc(d))
}

export function jobDeliveredHtml(d: SongJobEmailFields): string {
  return renderEmailHtml(deliveredDoc(d))
}
