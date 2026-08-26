import { describe, expect, it } from 'vitest'
import { SongJobSchema } from '@/lib/song-job-schema'
import { GUARANTEED, OFFERED, isGuaranteed, turnaroundNote } from '@/lib/language-pairs'
import { LANGUAGE_CODES } from '@/lib/languages'

/**
 * These guard the two things a portal can get wrong in a way a marketing page cannot: taking
 * a file it cannot use, and promising a delivery time it cannot meet.
 */

const asset = (kind: 'instrumental' | 'vocal' | 'full_mix') => ({
  kind,
  path: `u/j/${kind}.wav`,
  filename: `${kind}.wav`,
  bytes: 50_000_000,
})

const base = {
  title: 'Test Song',
  primaryArtist: 'Test Artist',
  sourceLanguage: 'EN',
  targetLanguage: 'ES',
  rightsWarranty: true as const,
}

describe('what counts as a usable submission', () => {
  it('accepts a full stem set', () => {
    const r = SongJobSchema.safeParse({ ...base, assets: [asset('instrumental'), asset('vocal')] })
    expect(r.success).toBe(true)
  })

  it('accepts a full mix from somebody with no stems', () => {
    const r = SongJobSchema.safeParse({ ...base, assets: [asset('full_mix')] })
    expect(r.success).toBe(true)
  })

  it('rejects half a stem set', () => {
    // An instrumental with no vocal cannot be re-sung, and a vocal with no instrumental has
    // nothing to sit over. Either is a job that looks complete and cannot be started.
    for (const half of ['instrumental', 'vocal'] as const) {
      const r = SongJobSchema.safeParse({ ...base, assets: [asset(half)] })
      expect(r.success).toBe(false)
    }
  })

  it('rejects a job with no files at all', () => {
    expect(SongJobSchema.safeParse({ ...base, assets: [] }).success).toBe(false)
  })
})

describe('a voice can name the part it sings', () => {
  it('accepts and trims an optional part label on a vocal', () => {
    const r = SongJobSchema.safeParse({
      ...base,
      assets: [asset('instrumental'), { ...asset('vocal'), part: '  Chorus  ' }],
    })
    expect(r.success).toBe(true)
    if (r.success) {
      const vocal = r.data.assets.find((a) => a.kind === 'vocal')
      expect(vocal?.part).toBe('Chorus')
    }
  })

  it('is optional, so a submission with no parts is still valid', () => {
    const r = SongJobSchema.safeParse({ ...base, assets: [asset('full_mix')] })
    expect(r.success).toBe(true)
  })

  it('rejects a part label long enough to be a note rather than a label', () => {
    const r = SongJobSchema.safeParse({
      ...base,
      assets: [{ ...asset('full_mix'), part: 'x'.repeat(61) }],
    })
    expect(r.success).toBe(false)
  })
})

describe('the rights warranty', () => {
  it('cannot be absent, false, or anything other than true', () => {
    // A literal rather than a boolean on purpose. This is the statement the eventual agreement
    // is argued from, so a missing value has to be a failure rather than a default.
    for (const bad of [undefined, false, 'true', 1, null]) {
      const r = SongJobSchema.safeParse({
        ...base,
        assets: [asset('full_mix')],
        rightsWarranty: bad,
      })
      expect(r.success).toBe(false)
    }
  })
})

describe('language pairs', () => {
  it('refuses a translation into the language it is already in', () => {
    const r = SongJobSchema.safeParse({
      ...base,
      targetLanguage: 'EN',
      assets: [asset('full_mix')],
    })
    expect(r.success).toBe(false)
  })

  it('offers exactly the languages the rest of the site lists', () => {
    // A portal and a marketing page disagreeing about what exists is the drift that the
    // shared list was created to prevent.
    expect([...OFFERED].sort()).toEqual([...LANGUAGE_CODES].sort())
  })

  it('never guarantees a pair it does not offer', () => {
    for (const key of GUARANTEED) {
      const [from, to] = key.split('>')
      expect(OFFERED).toContain(from)
      expect(OFFERED).toContain(to)
      expect(from).not.toBe(to)
    }
  })

  it('guarantees every pair it lets somebody submit', () => {
    /**
     * Henry's decision, 2026-08-11, taken after the trade-off was put to him twice: every
     * offered pair carries the turnaround promise, not just English and Spanish.
     *
     * This test is the honest statement of that. The version it replaced asserted the
     * unguaranteed branch behind `if (!isGuaranteed(...))`, which under this decision is never
     * entered, so it passed by doing nothing. A test that cannot fail is not a guardrail, and
     * one that quietly stops checking when a decision changes is worse than no test, because
     * the green tick is read as coverage.
     *
     * What this now protects: adding a language to `lib/languages.ts` widens the promise to
     * every pair involving it. That is the intended behaviour and it should be a deliberate
     * act, so it is written down where a diff will show it.
     */
    for (const from of OFFERED) {
      for (const to of OFFERED) {
        if (from === to) continue
        expect(isGuaranteed(from, to)).toBe(true)
      }
    }
    expect(GUARANTEED.length).toBe(OFFERED.length * (OFFERED.length - 1))
  })

  it('still declines to name a figure for a pair it does not guarantee', () => {
    // The branch is no longer reachable through the form, and it is kept alive on purpose:
    // narrowing GUARANTEED again must not require rediscovering how the other half reads.
    // A same-language pair is unsubmittable and ungaranteed, so it exercises it honestly.
    const unguaranteed = turnaroundNote('EN', 'EN')
    expect(isGuaranteed('EN', 'EN')).toBe(false)
    expect(unguaranteed).not.toMatch(/\d+ hours/)
    expect(unguaranteed).toMatch(/confirm timing/i)
  })

  it('promises a number for a pair it does guarantee', () => {
    expect(turnaroundNote('EN', 'ES')).toMatch(/48 hours/)
    expect(turnaroundNote('JA', 'KO')).toMatch(/48 hours/)
  })
})
