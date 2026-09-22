import { describe, expect, it } from 'vitest'
import {
  rerollDeliveredHtml,
  rerollDeliveredSubject,
  rerollDeliveredText,
  type RerollDeliveredEmailFields,
} from '@/lib/reroll-delivered-email'

/**
 * `reroll-delivered`: a CHILD `song_jobs` row (`reroll_index > 0`) reached `delivered`. Says
 * "Take N is ready" and how many re-rolls remain on the family. See `docs/emails/README.md`.
 */

const FIELDS: RerollDeliveredEmailFields = {
  title: 'Midnight City',
  rerollIndex: 1,
  rerollsRemaining: 1,
}

describe('subject', () => {
  it('names the take, not just the track', () => {
    expect(rerollDeliveredSubject(FIELDS)).toBe('lyrical: Take 2 of Midnight City is ready')
  })
})

describe('body', () => {
  it('says which take this is', () => {
    expect(rerollDeliveredText(FIELDS)).toMatch(/Take 2/)
  })

  it('says how many re-rolls remain', () => {
    expect(rerollDeliveredText({ ...FIELDS, rerollsRemaining: 1 })).toMatch(/1/)
  })

  it('says when none remain, rather than a confusing "0 left"', () => {
    const text = rerollDeliveredText({ ...FIELDS, rerollIndex: 2, rerollsRemaining: 0 })
    expect(text).toMatch(/no re-rolls left|used both/i)
  })

  it('links to the studio and carries no storage path', () => {
    const html = rerollDeliveredHtml(FIELDS)
    expect(html).toContain('/studio')
    expect(html).not.toMatch(/submissions\/|supabase\.co|\.wav|\.mp3|\.flac/i)
  })

  it('has a Listen call to action', () => {
    expect(rerollDeliveredHtml(FIELDS)).toMatch(/Listen/i)
  })

  it('never uses an em dash', () => {
    expect(rerollDeliveredText(FIELDS)).not.toContain('—')
    expect(rerollDeliveredHtml(FIELDS)).not.toContain('—')
  })
})
