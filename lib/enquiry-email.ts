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

export function enquiryEmailSubject(d: EnquiryEmailFields): string {
  return `Lyrical enquiry: ${d.name} (${d.role})`
}

export function enquiryEmailText(d: EnquiryEmailFields, messageLimit?: number): string {
  let message = d.message?.trim() || ''
  if (messageLimit !== undefined && message.length > messageLimit) {
    message = `${message.slice(0, messageLimit)}\n\n[message truncated here, it was too long to send this way]`
  }

  return [
    `Name:      ${d.name}`,
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
export function enquiryMailto(d: EnquiryEmailFields, to: string): string {
  const subject = encodeURIComponent(enquiryEmailSubject(d))
  const body = encodeURIComponent(enquiryEmailText(d, MAILTO_MESSAGE_LIMIT))
  return `mailto:${to}?subject=${subject}&body=${body}`
}
