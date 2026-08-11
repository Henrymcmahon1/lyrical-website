import { describe, expect, it } from 'vitest'
import { CREAM, GRAPHITE, esc, renderEmailHtml, renderEmailText, type EmailDoc } from '@/lib/email-shell'

/**
 * The shell every email is rendered through.
 *
 * These are not style opinions. Each one is a rule that, when broken, produces an email that is
 * unreadable or unsafe in some client nobody here can test against.
 */

const doc: EmailDoc = {
  preheader: 'The line an inbox shows after the subject.',
  eyebrow: 'Accepted',
  heading: 'We have taken on A Song.',
  blocks: [
    { type: 'paragraph', text: 'A plain sentence.' },
    { type: 'rows', rows: [['Artist', 'An Artist'], ['Language', 'English to Spanish']] },
    { type: 'cta', label: 'Open the studio', href: 'https://lyricalglobal.com/studio' },
    { type: 'note', text: 'A quieter aside.' },
  ],
}

describe('escaping', () => {
  it('neutralises markup in every value that reaches a template', () => {
    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(esc('A & B')).toBe('A &amp; B')
    expect(esc('" onload=x')).toBe('&quot; onload=x')
  })

  it('escapes every kind of block, not just paragraphs', () => {
    const nasty: EmailDoc = {
      preheader: '<img onerror=x>',
      heading: '<script>a</script>',
      blocks: [
        { type: 'paragraph', text: '<b>p</b>' },
        { type: 'rows', rows: [['<i>k</i>', '<i>v</i>']] },
        { type: 'note', text: '<u>n</u>' },
        { type: 'cta', label: '<em>go</em>', href: 'https://x.example/"onmouseover="y' },
      ],
    }
    const html = renderEmailHtml(nasty)
    expect(html).not.toMatch(/<script>|<img onerror|<b>p<\/b>|<i>k<\/i>|<u>n<\/u>|<em>go<\/em>/)
    // The href too: an unescaped quote there breaks out of the attribute, which is the one
    // place a link can become script without ever looking like markup.
    expect(html).not.toMatch(/"onmouseover="/)
  })
})

describe('the things email clients force on us', () => {
  const html = renderEmailHtml(doc)

  it('paints an opaque background rather than inheriting one', () => {
    /**
     * There is no `<head>` for `color-scheme` and no surviving `<style>` for a media query, so
     * an email cannot do dark mode. The only thing that works everywhere is painting the
     * surface. A transparent design becomes unreadable the moment a client inverts it, which
     * is the same lesson the Zoho signature taught.
     */
    expect(html.match(new RegExp(`background:${CREAM}`, 'g'))?.length ?? 0).toBeGreaterThan(2)
  })

  it('inlines every style, because Gmail strips style blocks', () => {
    expect(html).not.toMatch(/<style|class=/)
  })

  it('lays out with tables, because Outlook renders through Word', () => {
    expect(html).toContain('<table')
    expect(html).not.toMatch(/display:\s*(flex|grid)/)
  })

  it('carries a preheader that is hidden in the body and visible in the list', () => {
    expect(html).toContain(doc.preheader)
    expect(html).toMatch(/display:none;max-height:0/)
  })

  it('never asks for a webfont it cannot have', () => {
    // Fraunces and Archivo are self-hosted woff2. Georgia and Helvetica are the stand-ins.
    expect(html).not.toMatch(/Fraunces|Archivo|@font-face|fonts\.googleapis/)
    expect(html).toContain('Georgia')
  })
})

describe('the logo at the top', () => {
  const html = renderEmailHtml(doc)

  it('is the real mark, served from our own domain', () => {
    expect(html).toContain('/brand/lyrical-email.png')
    // Absolute, because an email has no page to be relative to.
    expect(html).toMatch(/src="https?:\/\/[^"]+\/brand\/lyrical-email\.png"/)
  })

  it('falls back to the brand name when images are blocked', () => {
    /**
     * The important one. Plenty of clients block remote images by default and Outlook desktop
     * still does, so for a good share of readers the alt text IS the logo. Replacing a text
     * wordmark with an image is only safe because this reads identically when it fails.
     *
     * Lowercase, like everywhere else a person reads the name.
     */
    expect(html).toContain('alt="lyrical"')
    expect(html).not.toContain('alt="Lyrical"')
    expect(html).not.toMatch(/alt="(logo|image|)"/i)
  })

  it('reserves its space with width and height ATTRIBUTES, not just CSS', () => {
    // Outlook ignores CSS sizing on images and obeys only the attributes, and without them a
    // client that has not loaded the image yet reflows the whole email when it arrives.
    expect(html).toMatch(/<img[^>]+width="132"[^>]*/)
    expect(html).toMatch(/<img[^>]+height="34"[^>]*/)
  })

  it('is the only image in the message', () => {
    // Every extra remote image is another thing that can fail to load and another request that
    // tells a tracker the message was opened.
    expect(html.match(/<img/g)?.length).toBe(1)
  })
})

describe('the brand rules survive the trip', () => {
  const html = renderEmailHtml(doc)

  it('paints no gradient', () => {
    expect(html).not.toMatch(/-gradient\(/)
  })

  it('keeps ember off body text and on the button only', () => {
    /**
     * Ember on cream measures 3.2:1, which fails AA for body text and passes for large text.
     * That is the whole reason the brand rule says fills and large type only. The button label
     * must therefore stay at or above the large-text threshold.
     */
    const ctaLabel = html.match(/font-size:(\d+)px;font-weight:bold;line-height:1;color:#F7EFE1/)
    expect(ctaLabel).not.toBeNull()
    expect(Number(ctaLabel![1])).toBeGreaterThanOrEqual(17)
  })

  it('renders body copy in graphite', () => {
    expect(html).toContain(`color:${GRAPHITE}`)
  })
})

describe('the text version is built from the same blocks', () => {
  const text = renderEmailText(doc)

  it('carries every block, so the two versions cannot drift', () => {
    expect(text).toContain('We have taken on A Song.')
    expect(text).toContain('A plain sentence.')
    expect(text).toContain('An Artist')
    expect(text).toContain('A quieter aside.')
  })

  it('turns a button into a usable line rather than dropping it', () => {
    // A text part that silently loses the call to action is worse than no text part: some
    // clients show it in preference to the HTML, and the reader sees a message with no way on.
    expect(text).toContain('Open the studio: https://lyricalglobal.com/studio')
  })

  it('contains no markup at all', () => {
    expect(text).not.toMatch(/<[a-z/]/i)
  })
})
