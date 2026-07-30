import { describe, it, expect } from 'vitest'
import {
  MAILTO_MESSAGE_LIMIT,
  enquiryEmailSubject,
  enquiryEmailText,
  enquiryMailto,
} from '@/lib/enquiry-email'

const FULL = {
  name: 'Jordan Brock',
  email: 'jordan@example.com',
  role: 'label' as const,
  company: 'Example Records',
  catalogue_size: '11-100' as const,
  target_languages: ['ES', 'PT'],
  message: 'We have 40 masters we would like quoted.',
  source: 'enquire',
  unlocked_audio: false,
}

const BARE = {
  name: 'Al',
  email: 'al@example.com',
  role: 'artist' as const,
  source: 'gate',
  unlocked_audio: true,
}

describe('enquiryEmailSubject', () => {
  it('names the person and their role, so an inbox rule can route it', () => {
    expect(enquiryEmailSubject(FULL)).toBe('Lyrical enquiry: Jordan Brock (label)')
  })
})

describe('enquiryEmailText', () => {
  it('includes every field that was provided', () => {
    const text = enquiryEmailText(FULL)
    expect(text).toContain('Jordan Brock')
    expect(text).toContain('jordan@example.com')
    expect(text).toContain('label')
    expect(text).toContain('Example Records')
    expect(text).toContain('11-100')
    expect(text).toContain('ES, PT')
    expect(text).toContain('We have 40 masters we would like quoted.')
    expect(text).toContain('enquire')
  })

  it('marks absent optional fields rather than printing "undefined"', () => {
    const text = enquiryEmailText(BARE)
    expect(text).not.toContain('undefined')
    expect(text).toContain('Company:   -')
    expect(text).toContain('(none)')
  })

  it('never leaks the honeypot or the timing field', () => {
    const text = enquiryEmailText({ ...FULL, website: '', elapsed_ms: 4321 } as never)
    expect(text).not.toContain('website')
    expect(text).not.toContain('4321')
  })
})

describe('enquiryMailto', () => {
  it('produces a mailto URL addressed to the given inbox', () => {
    const url = enquiryMailto(FULL, 'hello@example.com')
    expect(url.startsWith('mailto:hello@example.com?')).toBe(true)
  })

  it('carries the same subject the server would have sent', () => {
    const url = new URL(enquiryMailto(FULL, 'hello@example.com'))
    expect(url.searchParams.get('subject')).toBe(enquiryEmailSubject(FULL))
  })

  it('carries the same body the server would have sent', () => {
    const url = new URL(enquiryMailto(FULL, 'hello@example.com'))
    expect(url.searchParams.get('body')).toBe(enquiryEmailText(FULL))
  })

  it('percent-encodes newlines and separators so the URL survives a mail client', () => {
    const url = enquiryMailto(FULL, 'hello@example.com')
    // A raw newline or a bare & in the query would truncate the body.
    expect(url).not.toMatch(/\n/)
    expect(url.split('body=')[1]).not.toContain('&')
    expect(url).toContain('%0A')
  })

  it('truncates a very long message, because mail clients cap the URL', () => {
    const long = 'x'.repeat(MAILTO_MESSAGE_LIMIT + 500)
    const url = new URL(enquiryMailto({ ...FULL, message: long }, 'hello@example.com'))
    const body = url.searchParams.get('body') ?? ''
    expect(body.length).toBeLessThan(long.length)
    expect(body).toContain('truncated')
  })

  it('does not truncate a message that already fits', () => {
    const url = new URL(enquiryMailto(FULL, 'hello@example.com'))
    expect(url.searchParams.get('body')).not.toContain('truncated')
  })

  it('still works when every optional field is missing', () => {
    const url = enquiryMailto(BARE, 'hello@example.com')
    expect(() => new URL(url)).not.toThrow()
    expect(new URL(url).searchParams.get('body')).toContain('al@example.com')
  })
})
