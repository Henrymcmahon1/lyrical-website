import { describe, expect, it } from 'vitest'
import {
  jobAcceptedHtml,
  jobAcceptedSubject,
  jobAcceptedText,
  jobConfirmationHtml,
  jobConfirmationSubject,
  jobConfirmationText,
  jobDeliveredHtml,
  jobDeliveredSubject,
  jobDeliveredText,
  jobNotificationHtml,
  jobNotificationText,
  timingLine,
  type SongJobEmailFields,
} from '@/lib/song-job-email'
import { welcomeHtml, welcomeSubject, welcomeText } from '@/lib/welcome-email'

const base: SongJobEmailFields = {
  title: 'Test Song',
  primaryArtist: 'Test Artist',
  sourceLanguage: 'EN',
  targetLanguage: 'ES',
  fileCount: 2,
  featureNames: [],
  submitterEmail: 'someone@label.example',
}

/**
 * Every template lyrical sends, rendered both ways.
 *
 * Collected in one list so that a new template is covered by every rule below the moment it is
 * added to it, rather than being covered by whichever rules its author happened to remember.
 */
const EVERY_TEMPLATE = (d: SongJobEmailFields) => [
  jobNotificationText(d),
  jobNotificationHtml(d),
  jobConfirmationText(d),
  jobConfirmationHtml(d),
  jobAcceptedText(d),
  jobAcceptedHtml(d),
  jobDeliveredText(d),
  jobDeliveredHtml(d),
  welcomeText(),
  welcomeHtml(),
]

const EVERY_SUBJECT = (d: SongJobEmailFields) => [
  jobConfirmationSubject(d),
  jobAcceptedSubject(d),
  jobDeliveredSubject(d),
  welcomeSubject(),
]

describe('what an email must never contain', () => {
  it('never carries a storage path, a signed URL, a bucket name or a filename', () => {
    // Email is forwarded, archived and searched by systems nobody here controls. A link to an
    // unreleased master in an inbox is the master, for anyone who ever sees that inbox.
    const withFiles = { ...base, notes: 'nothing special' }
    const all = EVERY_TEMPLATE(withFiles).join('\n')

    expect(all).not.toMatch(/submissions\//)
    expect(all).not.toMatch(/supabase\.co/)
    expect(all).not.toMatch(/\.wav|\.flac|\.aiff/i)
    expect(all).not.toMatch(/token=|sign\/|X-Amz/i)
  })

  it('never uses an em-dash, including in the ones sent to customers', () => {
    // The standing style rule. Email is the copy nobody reviews on the way out.
    for (const rendered of EVERY_TEMPLATE(base)) {
      expect(rendered).not.toMatch(/—|&mdash;/)
    }
  })

  it('never claims the recording is generated', () => {
    // The same ban the site is held to. "AI-generated" implies the master is fabricated, which
    // is the claim the rule exists to prevent.
    for (const rendered of EVERY_TEMPLATE(base)) {
      expect(rendered).not.toMatch(/AI[-\s]generated/i)
    }
  })
})

describe('the brand renders lowercase, everywhere a person reads it', () => {
  it('never capitalises the name in a subject line', () => {
    for (const subject of EVERY_SUBJECT(base)) {
      expect(subject).not.toMatch(/Lyrical/)
    }
  })

  it('signs off in lowercase', () => {
    for (const rendered of EVERY_TEMPLATE(base)) {
      expect(rendered).not.toMatch(/Lyrical/)
    }
  })
})

describe('the lyric sheet, and where it is allowed to go', () => {
  // Built with real newlines via a template literal, deliberately: a lyric sheet IS multi-line,
  // and this way the fixture is the shape of the thing rather than an escaped version of it.
  const withLyrics = {
    ...base,
    lyrics: `[Verse 1]
Corazón partío
你好 世界`,
  }

  it('reaches the FOUNDER notification, which was Henrys call', () => {
    /**
     * On the record, 2026-08-12, taken after the argument against was put to him in writing:
     * email is forwarded, archived and indexed by systems nobody here controls, and unreleased
     * lyrics are the work itself rather than a pointer to it. He wanted them without opening
     * the queue. Asserted so the decision is visible rather than implied by an if statement.
     */
    expect(jobNotificationText(withLyrics)).toContain('Corazón partío')
    expect(jobNotificationHtml(withLyrics)).toContain('Corazón partío')
  })

  it('survives non-Latin script intact', () => {
    expect(jobNotificationText(withLyrics)).toContain('你好 世界')
  })

  it('NEVER reaches the customer confirmation, or any other template', () => {
    // The limit on that decision. Founders only, and there is nothing to gain by sending
    // somebody the sheet they wrote themselves.
    const others = [
      jobConfirmationText(withLyrics),
      jobConfirmationHtml(withLyrics),
      jobAcceptedText(withLyrics),
      jobAcceptedHtml(withLyrics),
      jobDeliveredText(withLyrics),
      jobDeliveredHtml(withLyrics),
    ].join(' ')
    expect(others).not.toContain('Corazón partío')
    expect(others).not.toContain('Verse 1')
  })

  it('is escaped in the html, like every other value a stranger supplies', () => {
    const nasty = { ...base, lyrics: '<script>alert(1)</script>' }
    const html = jobNotificationHtml(nasty)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('leaves the notification unchanged when there are none', () => {
    // Lyrics are optional, so the commonest case is no block at all rather than an empty one.
    expect(jobNotificationText(base)).not.toMatch(/lyrics/i)
  })
})

describe('the delivery email, which has no player behind it', () => {
  it('says the files are coming, and does not tell anyone to go and press play', () => {
    /**
     * There is no delivery bucket and no player in the studio: Henry's call on 2026-08-11 was
     * status plus email, with the audio going across by hand. An email that says "listen here"
     * pointing at a page that cannot is the `/hear` mistake one layer deeper, and this is the
     * test that stops a later session adding the link before the player exists.
     */
    const text = jobDeliveredText(base)
    expect(text).toMatch(/sending the files across/i)
    expect(text).not.toMatch(/log in|sign in|press play|listen here|in the studio/i)
  })
})

describe('the timing promise', () => {
  it('names a figure only for a guaranteed pair', () => {
    expect(timingLine('EN', 'ES')).toMatch(/48 hours/)
  })

  it('names it for every pair the portal accepts, since 2026-08-11', () => {
    // Henry widened GUARANTEED to all 56 pairs. The email is where that promise actually
    // reaches a person, so it is asserted here as well as at the source.
    expect(timingLine('JA', 'KO')).toMatch(/48 hours/)
    expect(timingLine('PT', 'FR')).toMatch(/48 hours/)
  })

  it('says nothing about hours for a pair we have not committed to', () => {
    // Unreachable through the form today, deliberately still tested: this is the wording that
    // comes back if the promise is ever narrowed, and it must not rot in the meantime.
    const line = timingLine('EN', 'EN')
    expect(line).not.toMatch(/\d+\s*hours/)
    expect(line).toMatch(/confirm timing/i)
  })

  it('counts from acceptance, not from submission', () => {
    // A human approves every job, so a Friday evening submission would otherwise start a
    // promise burning while nobody is looking at it.
    expect(timingLine('EN', 'ES')).toMatch(/once we accept it/i)
  })
})

describe('user input in the html', () => {
  it('escapes a title that contains markup', () => {
    const nasty = { ...base, title: '<script>alert(1)</script>' }
    const html = jobConfirmationHtml(nasty) + jobNotificationHtml(nasty)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes notes and the artist name too', () => {
    const nasty = { ...base, primaryArtist: 'A & B', notes: '"><img onerror=x>' }
    const html = jobNotificationHtml(nasty)
    expect(html).toContain('A &amp; B')
    expect(html).not.toContain('<img onerror')
  })
})
