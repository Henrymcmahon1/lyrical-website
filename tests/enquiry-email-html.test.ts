import { describe, it, expect } from 'vitest'
import { enquiryEmailHtml, enquiryEmailText } from '@/lib/enquiry-email'

const FULL = {
  name: 'Jordan Brock',
  email: 'jordan@example.com',
  role: 'label' as const,
  company: 'Example Records',
  catalogue_size: '11-100' as const,
  target_languages: ['ES', 'PT'],
  message: 'Line one.\nLine two.',
  source: 'enquire',
  unlocked_audio: false,
}

describe('the notification email carries the enquiry', () => {
  it('includes every provided field', () => {
    const html = enquiryEmailHtml(FULL)
    for (const v of ['Jordan Brock', 'jordan@example.com', 'label', 'Example Records', '11-100', 'ES, PT']) {
      expect(html, `missing ${v}`).toContain(v)
    }
  })

  it('keeps the line breaks in the message readable', () => {
    const html = enquiryEmailHtml(FULL)
    expect(html).toContain('Line one.')
    expect(html).toContain('Line two.')
    // A raw newline collapses to a single space in HTML, so it has to become a <br>.
    expect(html).toMatch(/Line one\.<br\s*\/?>/)
  })

  it('offers a one-click reply to the enquirer', () => {
    expect(enquiryEmailHtml(FULL)).toContain('mailto:jordan@example.com')
  })
})

describe('the notification email is safe to open', () => {
  it('escapes HTML in every user-supplied field', () => {
    const nasty = {
      ...FULL,
      name: '<script>alert(1)</script>',
      company: 'Acme " onmouseover="x',
      message: "<img src=x onerror=alert('xss')>",
    }
    const html = enquiryEmailHtml(nasty)

    // The property that matters is that no TAG can form and no attribute can be broken
    // out of. The characters themselves stay visible, which is correct: you should be able
    // to read exactly what somebody typed, inertly.
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('onmouseover="x')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(&#39;xss&#39;)&gt;')
    expect(html).toContain('Acme &quot; onmouseover=&quot;x')
  })

  it('escapes the email before putting it in a mailto href', () => {
    // An unescaped quote here would break out of the href attribute.
    const html = enquiryEmailHtml({ ...FULL, email: 'a"b@example.com' })
    expect(html).not.toContain('href="mailto:a"b@example.com"')
    expect(html).toContain('&quot;')
  })

  it('contains no script tag at all', () => {
    expect(enquiryEmailHtml(FULL).toLowerCase()).not.toContain('<script')
  })
})

describe('the notification email looks like Lyrical', () => {
  it('uses the locked brand colours', () => {
    const html = enquiryEmailHtml(FULL)
    expect(html).toContain('#F7EFE1') // cream
    expect(html).toContain('#1C1A19') // graphite
    expect(html).toContain('#4433D6') // indigo
  })

  it('styles inline only, since email clients strip stylesheets', () => {
    const html = enquiryEmailHtml(FULL)
    expect(html).not.toContain('<style')
    expect(html).not.toContain('<link')
    expect(html).toContain('style="')
  })

  it('carries the mark as a text character, which every client can render', () => {
    expect(enquiryEmailHtml(FULL)).toContain('&#8776;')
  })
})

describe('both formats handle a gate submission with no name', () => {
  const noName = { ...FULL, name: '', source: 'gate', message: '' }

  it('says so rather than leaving a blank in the HTML', () => {
    const html = enquiryEmailHtml(noName)
    expect(html).toContain('Not given')
    expect(html).not.toContain('undefined')
  })

  it('says so rather than leaving a blank in the plain text', () => {
    const text = enquiryEmailText(noName)
    expect(text).toContain('Not given')
    expect(text).not.toContain('undefined')
  })
})
