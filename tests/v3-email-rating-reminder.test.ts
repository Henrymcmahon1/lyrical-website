import { describe, expect, it } from 'vitest'
import {
  ratingReminderHtml,
  ratingReminderSubject,
  ratingReminderText,
  type RatingReminderEmailFields,
} from '@/lib/rating-reminder-email'

/**
 * `rating-reminder`: the one PRODUCT email in v3's scope (opt-out, one per person per day). A
 * gentle nudge, 24h after delivery, for a track nobody has rated yet. See docs/emails/README.md.
 */

const FIELDS: RatingReminderEmailFields = { title: 'Midnight City' }

describe('subject', () => {
  it('is gentle, not a demand', () => {
    expect(ratingReminderSubject(FIELDS)).toBe('lyrical: how did Midnight City turn out?')
  })
})

describe('body', () => {
  it('names the track', () => {
    expect(ratingReminderText(FIELDS)).toContain('Midnight City')
  })

  it('says why ratings help', () => {
    expect(ratingReminderText(FIELDS)).toMatch(/re-roll|better|improve|train|learn/i)
  })

  it('has a Rate your track call to action, to the studio', () => {
    const html = ratingReminderHtml(FIELDS)
    expect(html).toMatch(/Rate your track/i)
    expect(html).toContain('/studio')
  })

  it('carries no storage path', () => {
    expect(ratingReminderHtml(FIELDS)).not.toMatch(/submissions\/|supabase\.co|\.wav|\.mp3/i)
  })

  it('never uses an em dash', () => {
    expect(ratingReminderText(FIELDS)).not.toContain('—')
    expect(ratingReminderHtml(FIELDS)).not.toContain('—')
  })
})
