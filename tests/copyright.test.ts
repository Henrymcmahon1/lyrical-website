import { describe, it, expect } from 'vitest'
import { isCommercialMatch, COMMERCIAL_MATCH_THRESHOLD, type CopyrightCheckResult } from '@/lib/copyright'

/**
 * The business rule, pinned away from any provider or network call.
 *
 * `app/studio/self-serve-actions.ts` (phase 2, not built yet) is the thing that will actually
 * refuse a submission. This proves the rule it will consult says what the research doc decided,
 * which is a different, testable question from whether the network call ever runs.
 */

const result = (over: Partial<CopyrightCheckResult> = {}): CopyrightCheckResult => ({
  provider: 'acrcloud',
  match: true,
  confidence: 95,
  checkedAt: '2026-09-22T00:00:00.000Z',
  part: 'vocal',
  ...over,
})

describe('what counts as a commercial match', () => {
  it('blocks a confident match', () => {
    expect(isCommercialMatch(result({ match: true, confidence: 95 }))).toBe(true)
  })

  it('passes a clean result, no candidate found at all', () => {
    expect(isCommercialMatch(result({ match: false, confidence: 0 }))).toBe(false)
  })

  it('passes a weak candidate below the threshold', () => {
    expect(isCommercialMatch(result({ match: true, confidence: 40 }))).toBe(false)
  })

  it('blocks exactly at the threshold, not just above it', () => {
    // The threshold names the first confidence the product is no longer willing to let
    // through, not the last one it tolerates.
    expect(isCommercialMatch(result({ match: true, confidence: COMMERCIAL_MATCH_THRESHOLD }))).toBe(
      true,
    )
  })

  it('passes one point below the threshold', () => {
    expect(
      isCommercialMatch(result({ match: true, confidence: COMMERCIAL_MATCH_THRESHOLD - 1 })),
    ).toBe(false)
  })

  it('never blocks on confidence alone: match has to be true too', () => {
    // A provider could in principle hand back a stray high number alongside "no candidate".
    // The business rule does not trust a number it does not also trust the flag next to it.
    expect(isCommercialMatch(result({ match: false, confidence: 100 }))).toBe(false)
  })

  it('treats a non-finite confidence as no match, never as a pass by accident', () => {
    expect(isCommercialMatch(result({ match: true, confidence: NaN }))).toBe(false)
    expect(isCommercialMatch(result({ match: true, confidence: Infinity }))).toBe(false)
  })

  it('honours a caller-supplied threshold over the default', () => {
    expect(isCommercialMatch(result({ match: true, confidence: 60 }), 50)).toBe(true)
    expect(isCommercialMatch(result({ match: true, confidence: 60 }), 90)).toBe(false)
  })

  it('defaults to the exported threshold when none is given', () => {
    expect(
      isCommercialMatch(result({ match: true, confidence: COMMERCIAL_MATCH_THRESHOLD })),
    ).toBe(isCommercialMatch(result({ match: true, confidence: COMMERCIAL_MATCH_THRESHOLD }), COMMERCIAL_MATCH_THRESHOLD))
  })
})

describe('the threshold itself', () => {
  it('is documented on a 0-100 scale, the same scale ACRCloud returns', () => {
    expect(COMMERCIAL_MATCH_THRESHOLD).toBeGreaterThan(0)
    expect(COMMERCIAL_MATCH_THRESHOLD).toBeLessThanOrEqual(100)
  })
})
