import { describe, expect, it } from 'vitest'
import { LICENCE_TERMS_POINTS, LICENCE_TERMS_VERSION } from '@/lib/terms'

/**
 * The Door-2 personal-use licence. Pinned the same way the rights warranty is: the six points
 * are what the beta's "personal use only" promise rests on, so dropping one fails the build.
 * The sixth (added 22 Sep, handover section H) is the copyright-check consequence, not counsel's
 * text either, added the same day as the rest, hence no version bump.
 */
describe('the personal-use licence', () => {
  it('is versioned and keeps the six points the beta relies on', () => {
    expect(LICENCE_TERMS_VERSION).toBe('2026-09-22')
    expect(LICENCE_TERMS_POINTS).toHaveLength(6)
    const all = LICENCE_TERMS_POINTS.join(' ')
    for (const re of [
      /personal, non-commercial/,
      /streaming/,
      /official release/,
      /provenance mark/,
      /re-rolls/,
      /rights to/,
      /copyright-policy/,
    ]) expect(all).toMatch(re)
    // U+2014 is the em dash, spelled by code point so no editor or shell can turn it back into one.
    expect(all).not.toContain(String.fromCharCode(0x2014))
  })
})
