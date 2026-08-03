import { describe, it, expect } from 'vitest'
import { EnquirySchema, GATE_SOURCE } from '@/lib/enquiry-schema'

/**
 * The examples overlay asks for an email and the languages, nothing else. Published form
 * research puts a 7-field form near 11% against roughly 23% at 3, and asking a browsing
 * visitor for company and catalogue size to hear a sample is a contract-sized ask for a
 * browsing-sized intention.
 *
 * So `name` is required for a real enquiry and optional for the gate. It is NOT dropped from
 * the schema: the full form still demands it, because by then the visitor is asking to be
 * contacted and a reply needs somebody to address.
 */

const base = {
  email: 'jordan@example.com',
  role: 'label' as const,
  source: 'enquire',
  unlocked_audio: false,
  elapsed_ms: 9000,
}

describe('name is required for a real enquiry', () => {
  it('rejects a missing name', () => {
    const r = EnquirySchema.safeParse(base)
    expect(r.success).toBe(false)
  })

  it('rejects a one-character name', () => {
    const r = EnquirySchema.safeParse({ ...base, name: 'J' })
    expect(r.success).toBe(false)
  })

  it('accepts a real name', () => {
    const r = EnquirySchema.safeParse({ ...base, name: 'Jordan Brock' })
    expect(r.success).toBe(true)
  })
})

describe('name is optional for the examples gate', () => {
  it('accepts an omitted name', () => {
    const r = EnquirySchema.safeParse({ ...base, source: GATE_SOURCE })
    expect(r.success).toBe(true)
  })

  it('accepts an empty name', () => {
    const r = EnquirySchema.safeParse({ ...base, source: GATE_SOURCE, name: '' })
    expect(r.success).toBe(true)
  })

  it('still rejects a one-character name when one IS given', () => {
    // A half-typed name is a mistake worth catching, not a field to wave through.
    const r = EnquirySchema.safeParse({ ...base, source: GATE_SOURCE, name: 'J' })
    expect(r.success).toBe(false)
  })

  it('still requires a valid email, since that is the whole point of the gate', () => {
    const r = EnquirySchema.safeParse({ ...base, source: GATE_SOURCE, email: 'not-an-email' })
    expect(r.success).toBe(false)
  })
})

describe('the rest of the schema is unchanged', () => {
  it('still rejects an unknown language code', () => {
    const r = EnquirySchema.safeParse({
      ...base,
      name: 'Jordan Brock',
      target_languages: ['ES', 'XX'],
    })
    expect(r.success).toBe(false)
  })

  it('still accepts known language codes', () => {
    const r = EnquirySchema.safeParse({
      ...base,
      source: GATE_SOURCE,
      target_languages: ['ES', 'PT'],
    })
    expect(r.success).toBe(true)
  })

  it('still rejects a filled honeypot', () => {
    const r = EnquirySchema.safeParse({ ...base, name: 'Jordan Brock', website: 'spam.example' })
    expect(r.success).toBe(false)
  })
})

/**
 * Everything except name and email is now behind an optional disclosure, so a blank is the
 * expected submission, not an edge case. These pin the two things that could go wrong
 * quietly: a skipped question being rejected as invalid, and a skipped question being filled
 * in with a guess that then reads as fact in the inbox.
 */
describe('optional questions can actually be skipped', () => {
  const named = { ...base, name: 'Jordan Brock' }

  it('accepts an unanswered role and records it as "other"', () => {
    const r = EnquirySchema.safeParse({ ...named, role: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.role).toBe('other')
  })

  it('accepts a missing role entirely', () => {
    // The gate submits no role at all, so absent has to behave the same as blank.
    const r = EnquirySchema.safeParse({ ...named, role: undefined })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.role).toBe('other')
  })

  it('never guesses "artist" for somebody who did not answer', () => {
    const r = EnquirySchema.safeParse({ ...named, role: '' })
    expect(r.success && r.data.role).not.toBe('artist')
  })

  it('accepts an unanswered catalogue size and leaves it unset', () => {
    const r = EnquirySchema.safeParse({ ...named, catalogue_size: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.catalogue_size).toBeUndefined()
  })

  it('still rejects a role that is not a real option', () => {
    const r = EnquirySchema.safeParse({ ...named, role: 'ceo' })
    expect(r.success).toBe(false)
  })

  it('still requires an email', () => {
    expect(EnquirySchema.safeParse({ ...named, email: undefined }).success).toBe(false)
    expect(EnquirySchema.safeParse({ ...named, email: '' }).success).toBe(false)
  })

  it('still requires a name on a real enquiry', () => {
    expect(EnquirySchema.safeParse({ ...base, name: '' }).success).toBe(false)
  })

  it('still lets the gate through without a name', () => {
    const r = EnquirySchema.safeParse({ ...base, name: '', source: GATE_SOURCE })
    expect(r.success).toBe(true)
  })
})
