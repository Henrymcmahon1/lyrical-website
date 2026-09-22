/**
 * Build `docs/emails/mockups/<slug>.html`, one file per row in `docs/emails/README.md`, so Henry
 * can open the folder and see every email lyrical sends without digging through source.
 *
 *   npx tsx scripts/build-email-mockups.mjs
 *
 * Each file wraps the real `renderEmailHtml` output (a `<div>` fragment, meant to be dropped
 * into an email client's own document shell) in a minimal HTML document whose `<title>` is the
 * subject line, so the browser tab and the file itself both say what the email says. Sample data
 * only: no real customer names, emails, job ids or storage paths.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { welcomeHtml, welcomeSubject } from '../lib/welcome-email.ts'
import { planConfirmedHtml, planConfirmedSubject } from '../lib/plan-confirmed-email.ts'
import { deliveredHtml, deliveredSubject } from '../lib/delivered-email.ts'
import { rerollDeliveredHtml, rerollDeliveredSubject } from '../lib/reroll-delivered-email.ts'
import { notMadeHtml, notMadeSubject } from '../lib/not-made-email.ts'
import { confirmationHtml, confirmationSubject } from '../lib/enquiry-email.ts'
import { ratingReminderHtml, ratingReminderSubject } from '../lib/rating-reminder-email.ts'

const OUT_DIR = 'docs/emails/mockups'

/** One row per docs/emails/README.md, in the same order. */
const EMAILS = [
  {
    slug: 'welcome',
    subject: welcomeSubject(),
    html: welcomeHtml(),
  },
  {
    slug: 'plan-confirmed',
    subject: planConfirmedSubject({ planName: 'Plus', tracksIncluded: 5, renewsOn: '22 October 2026' }),
    html: planConfirmedHtml({ planName: 'Plus', tracksIncluded: 5, renewsOn: '22 October 2026' }),
  },
  {
    slug: 'track-delivered',
    subject: deliveredSubject({ title: 'Midnight City', targetLanguage: 'ES' }),
    html: deliveredHtml({ title: 'Midnight City', targetLanguage: 'ES' }),
  },
  {
    slug: 'reroll-delivered',
    subject: rerollDeliveredSubject({ title: 'Midnight City', rerollIndex: 1, rerollsRemaining: 1 }),
    html: rerollDeliveredHtml({ title: 'Midnight City', rerollIndex: 1, rerollsRemaining: 1 }),
  },
  {
    slug: 'track-not-made',
    subject: notMadeSubject({ title: 'Midnight City' }),
    html: notMadeHtml({ title: 'Midnight City' }),
  },
  {
    slug: 'eoi-received',
    // The artist EOI form reuses the enquiry confirmation path verbatim (spec §8): same
    // function, source = 'artist_eoi'. Sample data reflects an artist's EOI, not a generic enquiry.
    subject: confirmationSubject(),
    html: confirmationHtml({
      name: 'Coffey Anderson',
      email: 'team@coffeyanderson.example',
      role: 'artist',
      company: 'Coffey Anderson Music',
      source: 'artist_eoi',
      unlocked_audio: false,
    }),
  },
  {
    slug: 'enquiry-received',
    subject: confirmationSubject(),
    html: confirmationHtml({
      name: 'Mara Okonjo',
      email: 'mara@northlightrecords.example',
      role: 'label',
      company: 'Northlight Records',
      source: 'enquire',
      unlocked_audio: false,
    }),
  },
  {
    slug: 'rating-reminder',
    subject: ratingReminderSubject({ title: 'Midnight City' }),
    html: ratingReminderHtml({ title: 'Midnight City' }),
  },
]

mkdirSync(OUT_DIR, { recursive: true })

for (const e of EMAILS) {
  // eoi-received and enquiry-received are already full documents (confirmationHtml wraps its
  // own <!doctype html>); every other builder returns a fragment through email-shell.ts and
  // needs the document shell added here.
  const isFullDocument = e.html.trim().toLowerCase().startsWith('<!doctype html>')
  const page = isFullDocument
    ? e.html.replace(/<html>/i, `<html><head><meta charset="utf-8"><title>${escapeHtml(e.subject)}</title></head>`)
    : `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(e.subject)}</title>
</head>
<body style="margin:0;padding:0;">
${e.html}
</body>
</html>
`

  writeFileSync(`${OUT_DIR}/${e.slug}.html`, page)
  console.log(`${e.slug.padEnd(18)} ${e.subject}`)
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
