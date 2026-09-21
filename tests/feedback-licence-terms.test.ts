import { describe, expect, it } from 'vitest'
import { LICENCE_TERMS_POINTS, LICENCE_TERMS_VERSION } from '@/lib/terms'

/**
 * The Door-2 personal-use licence. Pinned the same way the rights warranty is: the five points
 * are what the beta's "personal use only" promise rests on, so dropping one fails the build.
 */
describe('the personal-use licence', () => {
  it('is versioned and keeps the five points the beta relies on', () => {
    expect(LICENCE_TERMS_VERSION).toBe('2026-09-22')
    expect(LICENCE_TERMS_POINTS).toHaveLength(5)
    const all = LICENCE_TERMS_POINTS.join(' ')
    for (const re of [/personal, non-commercial/, /streaming/, /official release/, /provenance mark/, /re-rolls/]) expect(all).toMatch(re)
    expect(all).not.toMatch(/—/)
  })
})
