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

  it('promises a number only where the pair is guaranteed', () => {
    // The important half. An offered-but-unguaranteed pair still works, it just declines to
    // name a figure, which is true and costs nothing.
    expect(turnaroundNote('EN', 'ES')).toMatch(/48 hours/)
    expect(isGuaranteed('EN', 'ES')).toBe(true)

    const ungurantee = turnaroundNote('JA', 'KO')
    if (!isGuaranteed('JA', 'KO')) {
      expect(ungurantee).not.toMatch(/\d+ hours/)
      expect(ungurantee).toMatch(/confirm timing/i)
    }
  })
})
