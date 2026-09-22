/**
 * The 6-digit sign in code email is sent by SUPABASE, not by us, and that is a real change from
 * the old magic link (`app/(public)/studio/sign-in/actions.ts` used to build and send that one
 * itself through `lib/mailer.ts`, and `lib/sign-in-email.ts` held its copy).
 *
 * `signInWithOtp` never hands the raw 6-digit code back to the server: Supabase generates it,
 * emails it, and only the person holding that email can produce it again through `verifyOtp`.
 * There is nothing for `mailCustomer` to send, so this file is not a set of functions like the
 * other `*-email.ts` files. It is the COPY, for a human to paste into a dashboard, because that
 * is the only place it can be rendered.
 *
 * ## What Henry needs to do, once, for the code to be six digits and branded rather than a link
 *
 * 1. Supabase dashboard -> Authentication -> Emails -> "Magic Link" template. Supabase reuses
 *    this one template for both the link and the code; which one a user gets depends on whether
 *    the template body renders `{{ .ConfirmationURL }}` (a link) or `{{ .Token }}` (a 6-digit
 *    code) - `{{ .Token }}` is what turns it into a code. Set the Subject and Body from the
 *    constants below.
 * 2. Supabase dashboard -> Authentication -> Emails -> SMTP Settings -> "Enable Custom SMTP",
 *    using Resend's SMTP credentials (host smtp.resend.com, port 465, the same RESEND_API_KEY as
 *    the SMTP password, from address on a domain verified in Resend). Without custom SMTP,
 *    Supabase's own mailer ignores template edits entirely and is rate limited for testing, the
 *    same two problems `docs/HANDOVER-v3-2026-09-22.md` §A already found with the old link.
 *
 * `requestSignInCode` in `app/(public)/studio/sign-in/actions.ts` calls `signInWithOtp` with no
 * `emailRedirectTo`, which is what tells Supabase to send the code rather than a link.
 */

export const OTP_EMAIL_SUBJECT = 'lyrical: your sign in code'

/**
 * Plain text, for the Supabase template's text body. `{{ .Token }}` is Supabase's own
 * placeholder syntax and must be pasted verbatim; it renders as the 6-digit code at send time.
 */
export const OTP_EMAIL_BODY_TEXT = [
  'Your lyrical sign in code is {{ .Token }}',
  '',
  'Enter it on the sign in page. It works once and expires in 10 minutes.',
  '',
  'If you did not ask for this, ignore it. Nobody can sign in as you without this code.',
].join('\n')

/**
 * A minimal HTML body for the same Supabase template field. Deliberately not run through
 * `lib/email-shell.ts`: that renderer lives on our own server, and this markup is pasted into a
 * dashboard we do not control the delivery pipeline for. Simple, inline styled, and safe in any
 * mail client, matching why `email-shell.ts` itself avoids anything fancier.
 */
export const OTP_EMAIL_BODY_HTML =
  '<p style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#1C1A19;">' +
  'Your lyrical sign in code is</p>' +
  '<p style="font-family:Helvetica,Arial,sans-serif;font-size:32px;font-weight:bold;' +
  'letter-spacing:4px;color:#1C1A19;">{{ .Token }}</p>' +
  '<p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#1C1A19;opacity:.6;">' +
  'Enter it on the sign in page. It works once and expires in 10 minutes. If you did not ask ' +
  'for this, ignore it.</p>'
