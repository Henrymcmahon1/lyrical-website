import { describe, expect, it } from 'vitest'
import { FeedbackSchema, FEEDBACK_TAGS, isFeedbackRating } from '@/lib/feedback-schema'

const JOB = '11111111-2222-3333-4444-555555555555'
const parse = (v: unknown) => FeedbackSchema.safeParse(v)

describe('feedback schema', () => {
  it('up needs no note; down needs twenty trimmed characters', () => {
    expect(parse({ jobId: JOB, rating: 'up' }).success).toBe(true)
    expect(parse({ jobId: JOB, rating: 'down' }).success).toBe(false)
    expect(parse({ jobId: JOB, rating: 'down', note: '   too short      ' }).success).toBe(false)
    const r = parse({ jobId: JOB, rating: 'down', note: '  Verse 2 line 3 is late  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.note).toBe('Verse 2 line 3 is late')
  })
  it('accepts known tags only and defaults to none', () => {
    expect(FEEDBACK_TAGS).toEqual(['timing', 'pronunciation', 'voice', 'meaning', 'mix', 'other'])
    expect(parse({ jobId: JOB, rating: 'up', tags: ['timing', 'mix'] }).success).toBe(true)
    expect(parse({ jobId: JOB, rating: 'up', tags: ['tempo'] }).success).toBe(false)
    const none = parse({ jobId: JOB, rating: 'up' })
    if (none.success) expect(none.data.tags).toEqual([])
  })
  it('refuses a rating that is not up or down, and a malformed id', () => {
    expect(parse({ jobId: JOB, rating: 'meh' }).success).toBe(false)
    expect(parse({ jobId: 'x', rating: 'up' }).success).toBe(false)
  })
})

describe('isFeedbackRating: the text column read back as the two ratings', () => {
  it('accepts up and down only', () => {
    expect(isFeedbackRating('up')).toBe(true)
    expect(isFeedbackRating('down')).toBe(true)
    for (const v of ['', 'Up', 'sideways']) expect(isFeedbackRating(v)).toBe(false)
  })
})
