import { Resend } from 'resend'
import { canEmailStrangers, enquiryRecipients } from './enquiry-email'

/**
 * One place that knows how to put an email on the wire.
 *
 * Three call sites need this now, and they used to be one: the submission action, the queue's
 * accept and deliver moves, and the auth callback's welcome. Each of them independently has to
 * decide whether email is configured, whether a customer may be mailed at all, and what to do
 * when Resend has a bad minute. Three copies of that reasoning is three chances to get the
 * stranger gate wrong, and getting it wrong means mailing a rights holder from an unverified
 * sender, which lands in spam and reads like a scam.
 *
 * ## Nothing here ever throws
 *
 * A send that fails must never take down the thing that triggered it. A job that is safely in
 * the database with a failed notification is an inconvenience; a job rejected because an email
 * provider timed out is a lost customer and a lost master. Every function returns a boolean
 * and logs. Callers are expected to ignore the result unless they have something better to do
 * with it.
 *
 * ## Awaited, never fired and forgotten
 *
 * Callers must `await` these. A serverless function that returns before its promises settle is
 * killed mid-flight and the email silently never goes. That has to happen at the call site,
 * which is why nothing here starts a background task.
 *
 * ⚠️ `RESEND_API_KEY` is not in `.env.local`, so none of this sends in development. It sends
 * on production. A local run logging "not configured" is the expected state, not a bug.
 */

export type Mail = {
  to: string | string[]
  subject: string
  text: string
  html: string
  replyTo?: string
}

type MailerConfig = { key: string; from: string }

function config(): MailerConfig | null {
  const key = process.env.RESEND_API_KEY
  const from = process.env.ENQUIRY_FROM_EMAIL
  if (!key || !from) return null
  return { key, from }
}

/** The founders, parsed from the comma separated `ENQUIRY_TO_EMAIL`. */
export function founderRecipients(): string[] {
  return enquiryRecipients(process.env.ENQUIRY_TO_EMAIL)
}

async function send(mail: Mail, label: string): Promise<boolean> {
  const cfg = config()
  if (!cfg) {
    console.warn(`[mail:${label}] Resend not configured; nothing was sent`)
    return false
  }

  const to = Array.isArray(mail.to) ? mail.to : [mail.to]
  if (!to.length) {
    console.warn(`[mail:${label}] no recipients; nothing was sent`)
    return false
  }

  try {
    const { error } = await new Resend(cfg.key).emails.send({
      from: cfg.from,
      to,
      replyTo: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
    if (error) {
      // Resend reports most failures in the body rather than by throwing, so a try/catch on
      // its own would call a rejected send a success.
      console.error(`[mail:${label}] rejected`, error)
      return false
    }
    return true
  } catch (e) {
    console.error(`[mail:${label}] failed`, e)
    return false
  }
}

/** Mail the founders. Always allowed: they are us. */
export async function mailFounders(mail: Omit<Mail, 'to'>, label: string): Promise<boolean> {
  return send({ ...mail, to: founderRecipients() }, label)
}

/**
 * Mail somebody who is not staff.
 *
 * Gated on `canEmailStrangers()`, which derives the switch from the sender address: if
 * `ENQUIRY_FROM_EMAIL` is ever pointed back at an `@resend.dev` address, every customer-facing
 * email turns itself off rather than sending from a domain that fails authentication. Silent by
 * design, and the reason the gate is a function rather than a flag somebody has to remember.
 */
export async function mailCustomer(mail: Mail, label: string): Promise<boolean> {
  const cfg = config()
  if (!cfg) {
    console.warn(`[mail:${label}] Resend not configured; nothing was sent`)
    return false
  }
  if (!canEmailStrangers(cfg.from)) {
    console.warn(`[mail:${label}] sender is not verified for outside mail; nothing was sent`)
    return false
  }
  return send(mail, label)
}
