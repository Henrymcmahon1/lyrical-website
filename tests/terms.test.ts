import { describe, expect, it } from 'vitest'
import {
  RIGHTS_TERMS_INTRO,
  RIGHTS_TERMS_POINTS,
  RIGHTS_TERMS_VERSION,
  VOICE_CONSENT_POINTS,
  VOICE_CONSENT_PREFACE,
  VOICE_CONSENT_VERSION,
} from '@/lib/terms'

/**
 * These pin the parts of counsel's wording that carry the legal weight, so a careless edit that
 * drops the indemnification or the legal entity name fails the build rather than shipping a
 * weaker warranty. They are not a substitute for a lawyer reading the text, but they stop the
 * specific ways an engineer breaks it.
 */

describe('the rights warranty text', () => {
  it('names the incorporated entity, the deliberate exception to the lowercase brand', () => {
    expect(RIGHTS_TERMS_INTRO).toContain('Lyrical Global Technologies, Inc.')
  })

  it('keeps all four representations, including indemnification', () => {
    expect(RIGHTS_TERMS_POINTS).toHaveLength(4)
    expect(RIGHTS_TERMS_POINTS.join(' ')).toMatch(/indemnify and hold the Company harmless/)
    expect(RIGHTS_TERMS_POINTS.join(' ')).toMatch(/samples, interpolations/)
  })

  it('carries a version, stamped onto every submission', () => {
    expect(RIGHTS_TERMS_VERSION).toBeTruthy()
    expect(VOICE_CONSENT_VERSION).toBeTruthy()
  })
})

describe('the voice consent', () => {
  it('keeps the voice-specific permission as a preface before the warranty', () => {
    expect(VOICE_CONSENT_PREFACE).toMatch(/model of their voice/)
  })

  it('reuses the same four representations', () => {
    expect(VOICE_CONSENT_POINTS).toEqual(RIGHTS_TERMS_POINTS)
  })
})
