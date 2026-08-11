import { describe, it, expect } from 'vitest'
import {
  canEmailStrangers,
  confirmationHtml,
  confirmationSubject,
  confirmationText,
} from '@/lib/enquiry-email'

const FULL = {
  name: 'Mara Okonjo',
  email: 'mara@northlight.example',
  role: 'label' as const,
  company: 'Northlight Records',
  catalogue_size: '11-100' as const,
  target_languages: ['ES', 'PT'],
  message: 'Forty masters we would like quoted.',
  source: 'enquire',
  unlocked_audio: false,
}

describe('who the confirmation is addressed to', () => {
  it('uses their first name when the form collected one', () => {
    expect(confirmationText(FULL)).toContain('Hi Mara')
  })

  it('greets generically when the gate collected no name', () => {
    const text = confirmationText({ ...FULL, name: '' })
    expect(text).not.toContain('Hi ,')
    expect(text).not.toContain('Not given')
    expect(text).not.toContain('undefined')
    expect(text.toLowerCase()).toContain('hi there')
  })
})

describe('what the confirmation must never leak', () => {
  it('does not echo internal routing fields back to the sender', () => {
    const html = confirmationHtml({ ...FULL, source: 'gate', unlocked_audio: true })
    for (const leak of ['gate', 'unlocked', 'user_agent', 'referrer', 'enquiries table']) {
      expect(html.toLowerCase(), `leaked "${leak}"`).not.toContain(leak.toLowerCase())
    }
  })

  it('escapes their own words before reflecting them', () => {
    const html = confirmationHtml({ ...FULL, name: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>')
    expect(html.toLowerCase()).not.toContain('<img')
  })

  it('carries no script tag', () => {
    expect(confirmationHtml(FULL).toLowerCase()).not.toContain('<script')
  })
})

describe('what the confirmation says', () => {
  it('names the company so it is obviously not spam', () => {
    expect(confirmationSubject()).toContain('lyrical')
  })

  it('commits to a reply time, which is the point of sending it', () => {
    expect(confirmationText(FULL).toLowerCase()).toContain('one working day')
  })

  it('leads with permission, as every Lyrical message does', () => {
    expect(confirmationText(FULL).toLowerCase()).toContain('approval')
  })

  it('uses the brand colours in the HTML part', () => {
    const html = confirmationHtml(FULL)
    expect(html).toContain('#F7EFE1')
    expect(html).toContain('#4433D6')
  })

  it('has no em-dashes, which the copy rules ban', () => {
    expect(confirmationText(FULL)).not.toContain('—')
    expect(confirmationHtml(FULL)).not.toContain('—')
  })

  it('never calls the work AI-generated', () => {
    const both = confirmationText(FULL) + confirmationHtml(FULL)
    expect(both.toLowerCase()).not.toContain('ai-generated')
    expect(both.toLowerCase()).not.toContain('ai generated')
  })
})

describe('when the confirmation is allowed to send', () => {
  it('refuses while the sender is still the Resend test address', () => {
    // onboarding@resend.dev can only deliver to the account owner, so sending to an
    // enquirer would simply fail. Better not to try.
    expect(canEmailStrangers('onboarding@resend.dev')).toBe(false)
    expect(canEmailStrangers('anything@resend.dev')).toBe(false)
  })

  it('allows it once the sender is a verified domain', () => {
    expect(canEmailStrangers('hello@lyrical.com')).toBe(true)
  })

  it('refuses when no sender is configured at all', () => {
    expect(canEmailStrangers(undefined)).toBe(false)
    expect(canEmailStrangers('')).toBe(false)
  })
})
