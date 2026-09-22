import { describe, expect, it } from 'vitest'
import { notMadeHtml, notMadeSubject, notMadeText, type NotMadeEmailFields } from '@/lib/not-made-email'

/**
 * `track-not-made`: a self-serve job reached `status = 'rejected'` at our end (a pipeline
 * failure, not the customer's fault). Plain apology, it did not count against their plan or
 * credit, make it again. See `docs/emails/README.md` and HANDOVER §14.6 ("a job that fails at
 * our end now gets status='rejected', quota_consumed_at=null and a credit refund").
 */

const FIELDS: NotMadeEmailFields = { title: 'Midnight City' }

describe('subject', () => {
  it('is plain, not alarming', () => {
    expect(notMadeSubject(FIELDS)).toBe('lyrical: Midnight City did not come out right')
  })
})

describe('body', () => {
  it('apologises in plain words', () => {
    expect(notMadeText(FIELDS)).toMatch(/sorry|apolog/i)
  })

  it('says plainly that it was not counted', () => {
    const text = notMadeText(FIELDS)
    expect(text).toMatch(/did not count|was not charged|credited back|refunded/i)
  })

  it('invites another try', () => {
    expect(notMadeHtml(FIELDS)).toMatch(/Make it again/i)
  })

  it('links to the studio and carries no storage path or internal error text', () => {
    const html = notMadeHtml(FIELDS)
    expect(html).toContain('/studio')
    expect(html).not.toMatch(/submissions\/|supabase\.co|pipeline_error|traceback/i)
  })

  it('never uses an em dash', () => {
    expect(notMadeText(FIELDS)).not.toContain('—')
    expect(notMadeHtml(FIELDS)).not.toContain('—')
  })
})
