import { describe, expect, it } from 'vitest'
import {
  jobConfirmationHtml,
  jobConfirmationText,
  jobNotificationHtml,
  jobNotificationText,
  timingLine,
  type SongJobEmailFields,
} from '@/lib/song-job-email'

const base: SongJobEmailFields = {
  title: 'Test Song',
  primaryArtist: 'Test Artist',
  sourceLanguage: 'EN',
  targetLanguage: 'ES',
  fileCount: 2,
  featureNames: [],
  submitterEmail: 'someone@label.example',
}

describe('what a submission email must never contain', () => {
  it('never carries a storage path, a signed URL, or a bucket name', () => {
    // Email is forwarded, archived and searched by systems nobody here controls. A link to an
    // unreleased master in an inbox is the master, for anyone who ever sees that inbox.
    const withFiles = { ...base, notes: 'nothing special' }
    const all = [
      jobNotificationText(withFiles),
      jobNotificationHtml(withFiles),
      jobConfirmationText(withFiles),
      jobConfirmationHtml(withFiles),
    ].join('\n')

    expect(all).not.toMatch(/submissions\//)
    expect(all).not.toMatch(/supabase\.co/)
    expect(all).not.toMatch(/\.wav|\.flac|\.aiff/i)
    expect(all).not.toMatch(/token=|sign\/|X-Amz/i)
  })
})

describe('the timing promise', () => {
  it('names a figure only for a guaranteed pair', () => {
    expect(timingLine('EN', 'ES')).toMatch(/48 hours/)
  })

  it('says nothing about hours for a pair we have not committed to', () => {
    const line = timingLine('JA', 'KO')
    if (!/48 hours/.test(line)) {
      expect(line).not.toMatch(/\d+\s*hours/)
      expect(line).toMatch(/confirm timing/i)
    }
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
