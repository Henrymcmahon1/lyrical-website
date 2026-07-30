/**
 * Render the notification email, and optionally send it for real.
 *
 * Writes both variants to `.email-preview/` so they can be opened or screenshotted, and with
 * `--send` puts them through Resend to the address in ENQUIRY_TO_EMAIL.
 *
 *   npx vercel env pull .env.prod.tmp --environment=production --yes
 *   node --env-file=.env.prod.tmp scripts/send-test-email.mjs
 *   node --env-file=.env.prod.tmp scripts/send-test-email.mjs --send
 *
 * Only ever sends to ENQUIRY_TO_EMAIL, never to an address supplied on the command line.
 * Delete the pulled env file when you are done with it.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { Resend } from 'resend'
import {
  enquiryEmailHtml,
  enquiryEmailSubject,
  enquiryEmailText,
} from '../lib/enquiry-email.ts'

const send = process.argv.includes('--send')

/** Two shapes that actually occur: the full enquiry, and the two-field examples gate. */
const CASES = [
  {
    file: 'notification-full-enquiry',
    label: 'Full enquiry, every field completed',
    data: {
      name: 'Mara Okonjo',
      email: 'mara@northlightrecords.example',
      role: 'label',
      company: 'Northlight Records',
      catalogue_size: '11-100',
      target_languages: ['ES', 'PT', 'FR'],
      message:
        'We have forty masters from our 2019 to 2023 catalogue that still stream well in Spain and Brazil.\n\nWe would want one flagship single first to see how the vocal holds up, then decide on the rest. Who signs off on the likeness rights, us or the artist directly?',
      source: 'enquire',
      unlocked_audio: false,
    },
  },
  {
    file: 'notification-examples-gate',
    label: 'Examples request, the two-field form',
    data: {
      name: '',
      email: 'a.reyes@example.com',
      role: 'other',
      company: '',
      catalogue_size: 'unsure',
      target_languages: ['ES'],
      message: '',
      source: 'gate',
      unlocked_audio: true,
    },
  },
]

mkdirSync('.email-preview', { recursive: true })

const from = process.env.ENQUIRY_FROM_EMAIL
const to = process.env.ENQUIRY_TO_EMAIL
const key = process.env.RESEND_API_KEY

console.log(`from: ${from ?? '(unset)'}`)
console.log(`to:   ${to ?? '(unset)'}`)
console.log(`key:  ${key ? 'present' : 'MISSING'}`)
console.log('')

const results = []

for (const c of CASES) {
  const subject = enquiryEmailSubject(c.data)
  const html = enquiryEmailHtml(c.data)
  const text = enquiryEmailText(c.data)

  writeFileSync(`.email-preview/${c.file}.html`, html)
  writeFileSync(`.email-preview/${c.file}.txt`, `Subject: ${subject}\n\n${text}`)

  const row = {
    label: c.label,
    subject,
    htmlBytes: html.length,
    textBytes: text.length,
    sent: false,
    id: null,
    error: null,
  }

  if (send) {
    if (!key || !from || !to) {
      row.error = 'RESEND_API_KEY, ENQUIRY_FROM_EMAIL or ENQUIRY_TO_EMAIL is not set'
    } else {
      try {
        const res = await new Resend(key).emails.send({
          from,
          to,
          replyTo: c.data.email,
          subject: `[TEST] ${subject}`,
          text,
          html,
        })
        if (res.error) {
          row.error = `${res.error.name}: ${res.error.message}`
        } else {
          row.sent = true
          row.id = res.data?.id ?? null
        }
      } catch (e) {
        row.error = e instanceof Error ? e.message : String(e)
      }
    }
  }

  results.push(row)
  console.log(`${c.label}`)
  console.log(`  subject : ${subject}`)
  console.log(`  html    : ${html.length} bytes -> .email-preview/${c.file}.html`)
  console.log(`  text    : ${text.length} bytes -> .email-preview/${c.file}.txt`)
  if (send) console.log(`  sent    : ${row.sent ? `yes, id ${row.id}` : `NO — ${row.error}`}`)
  console.log('')
}

writeFileSync('.email-preview/results.json', JSON.stringify(results, null, 2))

const failed = results.filter((r) => send && !r.sent)
console.log('='.repeat(60))
if (!send) console.log('Rendered only. Add --send to put these through Resend.')
else if (failed.length) console.log(`${failed.length} of ${results.length} FAILED to send.`)
else console.log(`All ${results.length} sent. Check ${to}.`)
process.exitCode = failed.length ? 1 : 0
