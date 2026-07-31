/**
 * One shape for an enquiry notification, used by two different senders.
 *
 * The route sends it through Resend. The form falls back to opening the visitor's own mail
 * client with the same thing prefilled, for the case where the backend is not configured or
 * the send fails. Both paths have to produce an identical subject and body, or an inbox rule
 * that matches one will silently miss the other, which is how a lead gets lost quietly.
 *
 * Pure and DOM-free so it runs on the server, in the client bundle, and under test.
 */

/**
 * The address a visitor is sent to when the form itself cannot deliver.
 *
 * Duplicated from `ENQUIRY_TO_EMAIL` on purpose: that one is server-only, and the fallback
 * has to be reachable from the client bundle. Change both together.
 */
export const CONTACT_EMAIL = 'henry.jamcmahon@gmail.com'

export type EnquiryEmailFields = {
  name: string
  email: string
  role: string
  company?: string
  catalogue_size?: string
  target_languages?: string[]
  message?: string
  source: string
  unlocked_audio: boolean
}

/**
 * How much of the message survives into a `mailto:` URL.
 *
 * The schema allows 4000 characters, but mail clients and browsers cap the URL they will
 * accept, historically around 2000. An over-long URL is not truncated politely: it either
 * fails to open or arrives with the body cut mid-sentence and no indication that it was.
 * Cutting it deliberately, with a visible note, is the honest version.
 */
export const MAILTO_MESSAGE_LIMIT = 1200

/**
 * The gate does not collect a name, so both formats have to say so rather than render a
 * blank label or the word "undefined".
 */
const displayName = (d: EnquiryEmailFields) => d.name?.trim() || 'Not given'

export function enquiryEmailSubject(d: EnquiryEmailFields): string {
  // The email address, not "Not given", when the gate did not collect a name. Otherwise
  // every examples request arrives with an identical subject line and threads together.
  const who = d.name?.trim() || d.email
  return `Lyrical enquiry: ${who} (${d.role})`
}

export function enquiryEmailText(d: EnquiryEmailFields, messageLimit?: number): string {
  let message = d.message?.trim() || ''
  if (messageLimit !== undefined && message.length > messageLimit) {
    message = `${message.slice(0, messageLimit)}\n\n[message truncated here, it was too long to send this way]`
  }

  return [
    `Name:      ${displayName(d)}`,
    `Email:     ${d.email}`,
    `Role:      ${d.role}`,
    `Company:   ${d.company || '-'}`,
    `Songs:     ${d.catalogue_size || '-'}`,
    `Languages: ${d.target_languages?.join(', ') || '-'}`,
    `Source:    ${d.source}`,
    `Unlocked:  ${d.unlocked_audio}`,
    '',
    'Message:',
    message || '(none)',
  ].join('\n')
}

/**
 * A `mailto:` URL carrying the whole enquiry, so a visitor whose submission could not be
 * delivered can still send it in one tap rather than retyping it into a blank email.
 *
 * Encoded with `encodeURIComponent` rather than URLSearchParams: the latter writes spaces as
 * `+`, which RFC 6068 does not define for mailto and which some clients render literally.
 */
/**
 * Escape for interpolation into HTML text or a double-quoted attribute.
 *
 * The message field is free text typed by a stranger and it lands in your inbox. Mail
 * clients vary in what they strip, so the only safe assumption is that they strip nothing.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const CREAM = '#F7EFE1'
const GRAPHITE = '#1C1A19'
const INDIGO = '#4433D6'
const RULE = '#DCD3C2'

/**
 * The notification, on brand.
 *
 * Table layout with inline styles only, because email clients strip `<style>` and have no
 * useful flexbox support. The mark is the literal approximately-equal character rather than
 * an image: no remote asset to block, no attachment, and it renders in every client. Sent
 * alongside the plain text part so a text-only reader still gets everything.
 */
export function enquiryEmailHtml(d: EnquiryEmailFields): string {
  const rows: [string, string][] = [
    ['Name', displayName(d)],
    ['Email', d.email],
    ['Role', d.role],
    ['Company', d.company || '-'],
    ['Songs', d.catalogue_size || '-'],
    ['Languages', d.target_languages?.join(', ') || '-'],
    ['Came from', d.source],
    ['Asked for examples', d.unlocked_audio ? 'Yes' : 'No'],
  ]

  const cell = `padding:8px 0;border-bottom:1px solid ${RULE};font-size:14px;line-height:1.5;`
  const label = `${cell}color:#857E74;width:150px;font-family:'Courier New',monospace;text-transform:uppercase;letter-spacing:1px;font-size:11px;`

  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td style="${label}">${esc(k)}</td><td style="${cell}color:${GRAPHITE};">${esc(v)}</td></tr>`,
    )
    .join('')

  const message = (d.message?.trim() || '(none)')
  const messageHtml = esc(message).replace(/\r?\n/g, '<br />')

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${CREAM};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${CREAM};">

<tr><td style="padding-bottom:24px;">
<span style="font-size:30px;line-height:1;color:${INDIGO};font-family:Georgia,serif;">&#8776;</span>
<span style="font-size:15px;color:${GRAPHITE};font-family:Georgia,serif;padding-left:8px;">lyrical</span>
</td></tr>

<tr><td style="padding-bottom:8px;">
<h1 style="margin:0;font-family:Georgia,serif;font-weight:normal;font-size:26px;line-height:1.25;color:${GRAPHITE};">
New enquiry from ${esc(displayName(d))}
</h1>
</td></tr>

<tr><td style="padding-bottom:24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#55504A;">
Reply straight to this email and it goes to them.
</td></tr>

<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Helvetica,Arial,sans-serif;border-top:1px solid ${RULE};">
${body}
</table>
</td></tr>

<tr><td style="padding-top:24px;font-family:'Courier New',monospace;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#857E74;">
Message
</td></tr>
<tr><td style="padding-top:8px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${GRAPHITE};">
${messageHtml}
</td></tr>

<tr><td style="padding-top:32px;">
<a href="mailto:${esc(d.email)}?subject=${encodeURIComponent(`Re: your Lyrical enquiry`)}"
   style="display:inline-block;background:${INDIGO};color:${CREAM};text-decoration:none;padding:13px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;">
Reply to ${esc(displayName(d))}
</a>
</td></tr>

<tr><td style="padding-top:32px;border-top:1px solid ${RULE};font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#857E74;">
Sent by the enquiry form on the Lyrical site. The full record is in the enquiries table.
</td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

/* ── The confirmation the enquirer receives ────────────────────────────────────
 *
 * Separate from the notification above, and deliberately so: this one goes to a stranger, so
 * it says nothing about how the enquiry was routed, reflects nothing back that could look
 * like a database record, and commits to a reply time. Without it the strongest moment in
 * the funnel ends with nothing but an on-screen thank-you.
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Whether the configured sender can reach somebody who is not the Resend account owner.
 *
 * Resend's test sender only delivers to the address that owns the account, so a confirmation
 * to an enquirer would silently fail. Derived from the sender rather than a separate flag, so
 * the moment ENQUIRY_FROM_EMAIL becomes a verified domain address this turns itself on with
 * nothing else to remember.
 */
export function canEmailStrangers(from: string | undefined): boolean {
  if (!from) return false
  return !from.trim().toLowerCase().endsWith('@resend.dev')
}

/** First name only, or a generic greeting when the gate collected no name. */
function greeting(d: EnquiryEmailFields): string {
  const first = d.name?.trim().split(/\s+/)[0]
  return first ? `Hi ${first},` : 'Hi there,'
}

export function confirmationSubject(): string {
  return 'Lyrical: we have your enquiry'
}

export function confirmationText(d: EnquiryEmailFields): string {
  return [
    greeting(d),
    '',
    'Thanks for getting in touch. Your enquiry has reached us and a person, not a system,',
    'will reply within one working day.',
    '',
    'One thing worth saying up front, because it is the part most people want to know:',
    'nothing is ever made without the rights holder or artist approval, and voice models are',
    'built only from catalogues we are permitted to use. Authorisation comes first, before any',
    'work begins.',
    '',
    'When we reply we will ask which song you want to start with and which language, so have',
    'a think about that if you have not already. One song is the usual first step.',
    '',
    'If anything is urgent in the meantime, just reply to this email.',
    '',
    'Lyrical',
    'Every song. Any language. Same soul.',
  ].join('\n')
}

export function confirmationHtml(d: EnquiryEmailFields): string {
  const para = `margin:0 0 18px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.62;color:${GRAPHITE};`

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${CREAM};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

<tr><td style="padding-bottom:28px;">
<span style="font-size:30px;line-height:1;color:${INDIGO};font-family:Georgia,serif;">&#8776;</span>
<span style="font-size:15px;color:${GRAPHITE};font-family:Georgia,serif;padding-left:8px;">lyrical</span>
</td></tr>

<tr><td>
<h1 style="margin:0 0 22px;font-family:Georgia,serif;font-weight:normal;font-size:27px;line-height:1.25;color:${GRAPHITE};">
${esc(greeting(d))}
</h1>

<p style="${para}">
Thanks for getting in touch. Your enquiry has reached us, and a person, not a system, will
reply within one working day.
</p>

<p style="${para}">
One thing worth saying up front, because it is the part most people want to know: nothing is
ever made without the rights holder or artist approval, and voice models are built only from
catalogues we are permitted to use. Authorisation comes first, before any work begins.
</p>

<p style="${para}">
When we reply we will ask which song you want to start with and which language, so have a
think about that if you have not already. One song is the usual first step.
</p>

<p style="${para}">
If anything is urgent in the meantime, just reply to this email.
</p>
</td></tr>

<tr><td style="padding-top:26px;border-top:1px solid ${RULE};">
<p style="margin:0;font-family:Georgia,serif;font-size:15px;color:${GRAPHITE};">Lyrical</p>
<p style="margin:6px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#857E74;">
Every song. Any language. Same soul.
</p>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

export function enquiryMailto(d: EnquiryEmailFields, to: string): string {
  const subject = encodeURIComponent(enquiryEmailSubject(d))
  const body = encodeURIComponent(enquiryEmailText(d, MAILTO_MESSAGE_LIMIT))
  return `mailto:${to}?subject=${subject}&body=${body}`
}
