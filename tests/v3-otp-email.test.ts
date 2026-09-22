import { describe, expect, it } from 'vitest'
import { OTP_EMAIL_BODY_HTML, OTP_EMAIL_BODY_TEXT, OTP_EMAIL_SUBJECT } from '@/lib/otp-email'

/**
 * This is copy for Henry to paste into the Supabase Auth email template, not a sender: Supabase
 * itself mints and sends the 6-digit code, so there is nothing here for `lib/mailer.ts` to call.
 * These tests pin the two things that make it actually work as a CODE rather than a link.
 */

describe('the Supabase template copy', () => {
  it('uses {{ .Token }}, which is what turns the template into a code rather than a link', () => {
    expect(OTP_EMAIL_BODY_TEXT).toContain('{{ .Token }}')
    expect(OTP_EMAIL_BODY_HTML).toContain('{{ .Token }}')
  })

  it('never references {{ .ConfirmationURL }}, the link placeholder this replaces', () => {
    expect(OTP_EMAIL_BODY_TEXT).not.toContain('ConfirmationURL')
    expect(OTP_EMAIL_BODY_HTML).not.toContain('ConfirmationURL')
  })

  it('lowercase brand, no em dash, in the subject and body', () => {
    expect(OTP_EMAIL_SUBJECT).not.toMatch(/Lyrical/)
    expect(OTP_EMAIL_SUBJECT).not.toContain('—')
    expect(OTP_EMAIL_BODY_TEXT).not.toContain('—')
    expect(OTP_EMAIL_BODY_HTML).not.toContain('—')
  })
})
