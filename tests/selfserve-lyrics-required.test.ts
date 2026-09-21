import { describe, expect, it } from 'vitest'
import { LYRICS_REQUIRED_MESSAGE, SelfServeJobSchema, SongJobSchema } from '@/lib/song-job-schema'

/**
 * The render worker refuses an automated job without a lyric sheet, so the self-serve door must
 * refuse it first, with words a customer can act on. The manual funnel keeps lyrics optional.
 */
const asset = (kind: 'instrumental' | 'vocal') => ({
  kind,
  path: `u/j/${kind}.wav`,
  filename: `${kind}.wav`,
  bytes: 1_000_000,
})
const base = {
  title: 'Song',
  primaryArtist: 'Artist',
  sourceLanguage: 'ES',
  targetLanguage: 'EN',
  rightsWarranty: true as const,
  licenceAccepted: true as const,
  assets: [asset('instrumental'), asset('vocal')],
}

describe('self-serve lyrics', () => {
  it('refuses a self-serve submission with no lyrics, naming the reason', () => {
    const r = SelfServeJobSchema.safeParse(base)
    expect(r.success).toBe(false)
    expect(r.success ? '' : r.error.issues.map((i) => i.message)).toContain(LYRICS_REQUIRED_MESSAGE)
  })
  it('refuses whitespace-only lyrics', () => {
    expect(SelfServeJobSchema.safeParse({ ...base, lyrics: '  \n ' }).success).toBe(false)
  })
  it('accepts a self-serve submission with lyrics', () => {
    expect(SelfServeJobSchema.safeParse({ ...base, lyrics: 'Ella es callaíta' }).success).toBe(true)
  })
  it('leaves the manual funnel optional', () => {
    const { licenceAccepted: _l, ...manual } = base
    expect(SongJobSchema.safeParse(manual).success).toBe(true)
  })
})
