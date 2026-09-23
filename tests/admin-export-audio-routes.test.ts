import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ADMIN_OK, NO_SESSION } from './admin-gate-fixtures'

/**
 * `/admin/export` and `/admin/audio` are the CSV download and signed-audio routes moved from
 * `/queue` on 2026-09-22. Both must still exist at their new path and still gate on the admin
 * session independently of the page, exactly as they did before the move.
 */

const requireAdmin = vi.fn()
vi.mock('@/lib/admin-session', () => ({
  requireAdmin: () => requireAdmin(),
}))

const from = vi.fn()
const createSignedUrl = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: (...a: unknown[]) => from(...a),
    storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => createSignedUrl(...a) }) },
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/admin/export', () => {
  it('refuses without a session, without reading any table', async () => {
    requireAdmin.mockResolvedValue(NO_SESSION)
    const { GET } = await import('@/app/admin/export/route')
    const res = await GET(new Request('https://x.test/admin/export?tab=work'))
    expect(res.status).toBe(404)
    expect(from).not.toHaveBeenCalled()
  })

  it('serves a CSV for the songs (work) table once signed in', async () => {
    requireAdmin.mockResolvedValue(ADMIN_OK)
    from.mockReturnValue({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    })
    const { GET } = await import('@/app/admin/export/route')
    const res = await GET(new Request('https://x.test/admin/export?tab=work'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
  })
})

describe('/admin/audio', () => {
  it('refuses without a session, without looking anything up', async () => {
    requireAdmin.mockResolvedValue(NO_SESSION)
    const { GET } = await import('@/app/admin/audio/route')
    const res = await GET(new Request('https://x.test/admin/audio?asset=11111111-1111-1111-1111-111111111111'))
    expect(res.status).toBe(404)
    expect(from).not.toHaveBeenCalled()
  })

  it('signs and redirects to the asset once signed in', async () => {
    requireAdmin.mockResolvedValue(ADMIN_OK)
    from.mockReturnValue({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: { path: 'user-1/job-1/f.wav' }, error: null }) }),
      }),
    })
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/f.wav' }, error: null })
    const { GET } = await import('@/app/admin/audio/route')
    const res = await GET(new Request('https://x.test/admin/audio?asset=11111111-1111-1111-1111-111111111111'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://signed.example/f.wav')
  })
})
