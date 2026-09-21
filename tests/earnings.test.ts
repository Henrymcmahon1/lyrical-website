import { describe, expect, it } from 'vitest'
import {
  ARTIST_SHARE,
  LYRICAL_SHARE,
  PAYOUT_PER_STREAM_USD,
  WORKED_EXAMPLE,
  clampAudienceShare,
  clampLanguages,
  estimateEarnings,
  usd,
} from '@/lib/earnings'

describe('estimateEarnings', () => {
  it('uses the locked constants', () => {
    expect([PAYOUT_PER_STREAM_USD, ARTIST_SHARE, LYRICAL_SHARE]).toEqual([0.004, 0.7, 0.3])
  })

  it('100,000 monthly streams, 2 languages, 20% share = 1,920 extra a year', () => {
    // 100000 * 12 * 0.2 * 2 * 0.004 = 1920. Artist 70% = 1344. lyrical 30% = 576.
    const e = estimateEarnings({ monthlyStreams: 100_000, songs: 12, languages: 2, audienceShare: 0.2 })
    expect([e.extraAnnualReceipts, e.artistAnnual, e.lyricalAnnual, e.perLanguage]).toEqual([
      1920, 1344, 576, 960,
    ])
    expect(estimateEarnings(WORKED_EXAMPLE).extraAnnualReceipts).toBe(1920)
  })

  it('songs is context, not a multiplier', () => {
    const a = estimateEarnings({ monthlyStreams: 50_000, songs: 1, languages: 1, audienceShare: 0.2 })
    const b = estimateEarnings({ monthlyStreams: 50_000, songs: 40, languages: 1, audienceShare: 0.2 })
    expect(a.extraAnnualReceipts).toBe(480)
    expect(b.extraAnnualReceipts).toBe(480)
  })

  it('clamps languages to 1..3 and audience share to 0.05..1', () => {
    expect([clampLanguages(0), clampLanguages(7), clampLanguages(2.6)]).toEqual([1, 3, 3])
    expect([clampAudienceShare(0), clampAudienceShare(4)]).toEqual([0.05, 1])
    expect(
      estimateEarnings({ monthlyStreams: 1000, songs: 1, languages: 9, audienceShare: 9 })
        .extraAnnualReceipts,
    ).toBe(144)
  })

  it('never goes negative, rounds money to cents, formats whole dollars', () => {
    expect(
      estimateEarnings({ monthlyStreams: -5, songs: 1, languages: 1, audienceShare: 0.2 })
        .extraAnnualReceipts,
    ).toBe(0)
    expect(
      estimateEarnings({ monthlyStreams: 1234, songs: 1, languages: 1, audienceShare: 0.2 })
        .artistAnnual,
    ).toBe(8.29)
    expect([usd(1920), usd(0), usd(1343.6)]).toEqual(['$1,920', '$0', '$1,344'])
  })
})
