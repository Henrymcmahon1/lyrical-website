import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AUDIENCE_SHARE,
  DEFAULT_LANGUAGES,
  MAX_LANGUAGES,
  MIN_AUDIENCE_SHARE,
  PAYOUT_PER_STREAM_USD,
  WORKED_EXAMPLE,
  clampAudienceShare,
  clampLanguages,
  cumulativeByYear,
  estimateEarnings,
  fiveYearTotal,
  usd,
} from '@/lib/earnings'

describe('estimateEarnings', () => {
  it('uses the locked constants', () => {
    expect([PAYOUT_PER_STREAM_USD, MAX_LANGUAGES, DEFAULT_LANGUAGES]).toEqual([0.004, 8, 2])
    expect([MIN_AUDIENCE_SHARE, DEFAULT_AUDIENCE_SHARE]).toEqual([0.1, 0.8])
  })

  it('100,000 monthly streams, 2 languages, 80% share = 7,680 gross a year', () => {
    // 100000 * 12 * 0.8 * 2 * 0.004 = 7680 gross. 3840 per language.
    const e = estimateEarnings({ monthlyStreams: 100_000, songs: 12, languages: 2, audienceShare: 0.8 })
    expect([e.grossAnnualReceipts, e.perLanguage]).toEqual([7680, 3840])
    expect(estimateEarnings(WORKED_EXAMPLE).grossAnnualReceipts).toBe(7680)
  })

  it('reports the gross figure only, no share of it', () => {
    const e = estimateEarnings(WORKED_EXAMPLE)
    expect(Object.keys(e).sort()).toEqual(
      ['audienceShare', 'grossAnnualReceipts', 'languages', 'perLanguage', 'songs'].sort(),
    )
  })

  it('songs is context, not a multiplier', () => {
    const a = estimateEarnings({ monthlyStreams: 50_000, songs: 1, languages: 1, audienceShare: 0.8 })
    const b = estimateEarnings({ monthlyStreams: 50_000, songs: 40, languages: 1, audienceShare: 0.8 })
    expect(a.grossAnnualReceipts).toBe(1920)
    expect(b.grossAnnualReceipts).toBe(1920)
  })

  it('clamps languages to 1..8 and audience share to 0.1..1', () => {
    expect([clampLanguages(0), clampLanguages(12), clampLanguages(2.6), clampLanguages(8)]).toEqual([
      1, 8, 3, 8,
    ])
    expect([clampAudienceShare(0), clampAudienceShare(4)]).toEqual([0.1, 1])
    // 1000 * 12 * 1 * 8 * 0.004 = 384
    expect(
      estimateEarnings({ monthlyStreams: 1000, songs: 1, languages: 20, audienceShare: 9 })
        .grossAnnualReceipts,
    ).toBe(384)
  })

  it('never goes negative, rounds money to cents, formats whole dollars', () => {
    expect(
      estimateEarnings({ monthlyStreams: -5, songs: 1, languages: 1, audienceShare: 0.8 })
        .grossAnnualReceipts,
    ).toBe(0)
    // 1234 * 12 * 0.8 * 1 * 0.004 = 47.3856 -> 47.39
    expect(
      estimateEarnings({ monthlyStreams: 1234, songs: 1, languages: 1, audienceShare: 0.8 })
        .grossAnnualReceipts,
    ).toBe(47.39)
    expect([usd(7680), usd(0), usd(3839.6)]).toEqual(['$7,680', '$0', '$3,840'])
  })
})

describe('cumulativeByYear', () => {
  const base = { monthlyStreams: 100_000, songs: 12, languages: 2, audienceShare: 0.8 }
  // annual gross = 7680, so cumulative is 7680, 15360, 23040, 30720, 38400 for years 1..5

  it('is linear: cumulative at year N equals the annual gross times N', () => {
    const rows = cumulativeByYear(base)
    expect(rows).toEqual([
      { year: 1, cumulative: 7680 },
      { year: 2, cumulative: 15360 },
      { year: 3, cumulative: 23040 },
      { year: 4, cumulative: 30720 },
      { year: 5, cumulative: 38400 },
    ])
  })

  it('scales with streams and languages, not with songs', () => {
    const flat = { monthlyStreams: 50_000, songs: 1, languages: 1, audienceShare: 0.8 }
    const flatTotal = cumulativeByYear(flat).at(-1)!.cumulative
    expect(cumulativeByYear({ ...flat, monthlyStreams: 100_000 }).at(-1)!.cumulative).toBeGreaterThan(
      flatTotal,
    )
    expect(cumulativeByYear({ ...flat, languages: 4 }).at(-1)!.cumulative).toBeGreaterThan(flatTotal)
    expect(cumulativeByYear({ ...flat, songs: 40 }).at(-1)!.cumulative).toBe(flatTotal)
  })

  it('clamps languages to 1..8 and audience share to 0.1..1, same as estimateEarnings', () => {
    // languages clamp to 8, audienceShare clamp to 1: annual = 1000 * 12 * 1 * 8 * 0.004 = 384
    const rows = cumulativeByYear({ monthlyStreams: 1000, songs: 1, languages: 20, audienceShare: 9 })
    expect(rows[0].cumulative).toBe(384)
    expect(rows[4].cumulative).toBe(1920)
  })

  it('defaults to 5 years, and fiveYearTotal matches the last row', () => {
    const rows = cumulativeByYear(WORKED_EXAMPLE)
    expect(rows).toHaveLength(5)
    expect(rows.map((r) => r.year)).toEqual([1, 2, 3, 4, 5])
    expect(fiveYearTotal(WORKED_EXAMPLE)).toBe(rows[4].cumulative)
    expect(fiveYearTotal(WORKED_EXAMPLE)).toBe(38400)
  })

  it('supports a custom horizon', () => {
    const rows = cumulativeByYear(base, 3)
    expect(rows.map((r) => r.year)).toEqual([1, 2, 3])
    expect(rows.at(-1)!.cumulative).toBe(23040)
  })
})
