import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SelfServeJobSchema, SongJobSchema } from '@/lib/song-job-schema'

/**
 * The personal-use licence gate. Self-serve submissions carry `licenceAccepted: true` or they
 * do not parse; the manual funnel's schema is untouched, so the live site keeps working.
 */
vi.mock('@/lib/supabase-client', () => ({ supabaseBrowser: () => ({}) }))
vi.mock('@/app/studio/submit-actions', () => ({ submitSongJob: vi.fn() }))
vi.mock('@/app/studio/self-serve-actions', () => ({ submitSelfServeJob: vi.fn() }))
const { SongSubmitForm } = await import('@/components/SongSubmitForm')

const asset = (kind: 'instrumental' | 'vocal') => ({ kind, path: `u/j/${kind}.wav`, filename: `${kind}.wav`, bytes: 1000 })
const base = { title: 'T', primaryArtist: 'A', sourceLanguage: 'EN', targetLanguage: 'ES', rightsWarranty: true as const, assets: [asset('instrumental'), asset('vocal')] }

describe('the licence gate', () => {
  it('self-serve requires licenceAccepted: true; the manual schema is untouched', () => {
    expect(SelfServeJobSchema.safeParse(base).success).toBe(false)
    expect(SelfServeJobSchema.safeParse({ ...base, licenceAccepted: false }).success).toBe(false)
    expect(SelfServeJobSchema.safeParse({ ...base, licenceAccepted: true }).success).toBe(true)
    expect(SongJobSchema.safeParse(base).success).toBe(true)
  })
  it('renders the licence box only in self-serve mode', () => {
    expect(renderToStaticMarkup(<SongSubmitForm selfServe />)).toContain('personal, non-commercial')
    expect(renderToStaticMarkup(<SongSubmitForm />)).not.toContain('personal, non-commercial')
  })
})
