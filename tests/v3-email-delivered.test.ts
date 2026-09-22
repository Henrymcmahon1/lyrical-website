import { describe, expect, it } from 'vitest'
import {
  deliveredHtml,
  deliveredSubject,
  deliveredText,
  type DeliveredEmailFields,
} from '@/lib/delivered-email'

/**
 * `track-delivered`: the self-serve Door-2 job just went from `song_jobs.status` to `delivered`.
 * Says the title and language, the licence line, and asks for the rating that unlocks a re-roll.
 * See `docs/emails/README.md`.
 */

const FIELDS: DeliveredEmailFields = {
  title: 'Midnight City',
  targetLanguage: 'ES',
}

describe('subject', () => {
  it('names the track and is ready, lowercase brand', () => {
    expect(deliveredSubject(FIELDS)).toBe('lyrical: Midnight City is ready')
    expect(deliveredSubject(FIELDS)).not.toMatch(/Lyrical/)
  })
})

describe('body', () => {
  it('names the track and the target language by its English name, not the raw code', () => {
    const text = deliveredText(FIELDS)
    expect(text).toContain('Midnight City')
    expect(text).toContain('Spanish')
    expect(text).not.toContain('>ES<')
  })

  it('carries the licence line', () => {
    const text = deliveredText(FIELDS)
    expect(text).toMatch(/personal use only/i)
  })

  it('asks for the rating, which is the thing this whole email exists to collect', () => {
    const text = deliveredText(FIELDS)
    expect(text).toMatch(/rate/i)
  })

  it('links to the studio, and only the studio: no storage path, no signed URL', () => {
    const html = deliveredHtml(FIELDS)
    expect(html).toContain('/studio')
    expect(html).not.toMatch(/submissions\/|supabase\.co|\.wav|\.mp3|\.flac/i)
  })

  it('renders identical content in html and text, from the same source', () => {
    expect(deliveredText(FIELDS)).toContain('Midnight City')
    expect(deliveredHtml(FIELDS)).toContain('Midnight City')
  })

  it('has a Listen and rate call to action', () => {
    const html = deliveredHtml(FIELDS)
    expect(html).toMatch(/Listen and rate/i)
  })

  it('never uses an em dash', () => {
    expect(deliveredText(FIELDS)).not.toContain('—')
    expect(deliveredHtml(FIELDS)).not.toContain('—')
  })
})
