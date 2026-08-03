import { describe, it, expect } from 'vitest'
import {
  CONTACT_EMAIL,
  MAILTO_MESSAGE_LIMIT,
  enquiryEmailSubject,
  enquiryEmailText,
  enquiryMailto,
  enquiryRecipients,
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

describe('enquiryEmailSubject falls back to the email when there is no name', () => {
  it('uses the email address, which is more use in an inbox than "Not given"', () => {
    // The examples gate does not collect a name. "Lyrical enquiry: Not given (other)" is
    // indistinguishable from every other gate request in a threaded inbox.
    expect(enquiryEmailSubject({ ...BARE, name: '' })).toBe(
      'Lyrical enquiry: al@example.com (artist)',
    )
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

describe('enquiryRecipients', () => {
  it('splits a comma separated list into separate addresses', () => {
    expect(enquiryRecipients('jordan@lyricalglobal.com,henry@lyricalglobal.com')).toEqual([
      'jordan@lyricalglobal.com',
      'henry@lyricalglobal.com',
    ])
  })

  it('trims the whitespace people naturally type after a comma', () => {
    expect(enquiryRecipients(' jordan@lyricalglobal.com ,  henry@lyricalglobal.com ')).toEqual([
      'jordan@lyricalglobal.com',
      'henry@lyricalglobal.com',
    ])
  })

  it('drops empty entries, so a trailing comma cannot fail the whole send', () => {
    expect(enquiryRecipients('jordan@lyricalglobal.com,,')).toEqual(['jordan@lyricalglobal.com'])
  })

  it('still handles a single address, which is the common case', () => {
    expect(enquiryRecipients('jordan@lyricalglobal.com')).toEqual(['jordan@lyricalglobal.com'])
  })

  it('returns nothing when the variable is unset or blank', () => {
    // The route treats an empty list as "mail not configured", so this is the value that
    // decides whether a visitor is told the form is not connected.
    expect(enquiryRecipients(undefined)).toEqual([])
    expect(enquiryRecipients('')).toEqual([])
    expect(enquiryRecipients('  ,  ')).toEqual([])
  })
})

describe('CONTACT_EMAIL', () => {
  it('is a shared company address, not a founder personal address', () => {
    // It ships in the client bundle and is rendered on the page. Putting an individual's
    // address here publishes it, and it breaks the moment that person changes role.
    expect(CONTACT_EMAIL).toBe('info@lyricalglobal.com')
  })
})
