import { renderEmailHtml, renderEmailText, type EmailDoc } from './email-shell'

/**
 * The sign in link, sent by us rather than by Supabase.
 *
 * ## Why we send it at all
 *
 * Supabase's built in mailer works, and three separate things were wrong with leaving it to do
 * this job.
 *
 * **It cannot be branded.** As of 2026-08-11 the dashboard refuses to let you edit an auth
 * template's subject or body at all unless custom SMTP is configured. So the first email a
 * rights holder ever receives from us was a default that looks like nothing else we send.
 *
 * **It is rate limited and meant for testing.** Supabase say so themselves. Signups would have
 * begun failing under volume, quietly, which is the worst way for a funnel to break.
 *
 * **Its link only worked in the browser that asked for it.** `signInWithOtp` from the browser
 * uses PKCE, which stashes a verifier in that browser's storage. Request the link on a laptop,
 * open it on a phone, and the exchange fails with an error about an expired link that has not
 * expired. That is a normal thing for a person to do and it looked like a bug in our site.
 *
 * Sending it ourselves fixes all three: it goes through Resend from `info@lyricalglobal.com`,
 * on the same shell as every other email, carrying a token hash that any browser can verify.
 *
 * ## What must not be in it
 *
 * The link IS the credential for as long as it lives. It is deliberately the only thing here,
 * with no storage paths, no job details and nothing about what the account contains, so that a
 * forwarded copy of this message gives away access and nothing else.
 */

export function signInSubject(): string {
  return 'lyrical: your sign in link'
}

function signInDoc(link: string, isNew: boolean): EmailDoc {
  return {
    preheader: 'One link, good for an hour, and it stops working after you use it.',
    // Always "Sign in", never "Welcome", even for a new account: the welcome email follows a
    // moment later once they actually open the link, and two Welcomes in one minute reads as a
    // system sending mail twice by mistake.
    eyebrow: 'Sign in',
    heading: isNew ? 'Open your studio.' : 'Here is your sign in link.',
    blocks: [
      {
        type: 'paragraph',
        text: isNew
          ? 'This link creates your studio and signs you in. There is no password to choose and none to remember.'
          : 'This link signs you in. There is no password to type.',
      },
      { type: 'cta', label: 'Open the studio', href: link },
      {
        type: 'note',
        text:
          'It works once and expires within the hour. If it has already been used, ask for a ' +
          'fresh one from the sign in page.',
      },
      {
        type: 'note',
        text:
          'If you did not ask for this, ignore it. Nothing happens until somebody opens the ' +
          'link, and nobody can sign in as you without it.',
      },
    ],
  }
}

export function signInText(link: string, isNew: boolean): string {
  return renderEmailText(signInDoc(link, isNew))
}

export function signInHtml(link: string, isNew: boolean): string {
  return renderEmailHtml(signInDoc(link, isNew))
}
