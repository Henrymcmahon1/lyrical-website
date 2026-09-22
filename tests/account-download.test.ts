import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `/studio/account/download`: "Download my data" as a file, not a page. Privileged (service
 * role), scoped to the caller by `lib/account-data.ts`'s exportAccountData, which is unit
 * tested on its own; this checks the session gate and the response shape.
 */
const currentUser = vi.fn()
const exportAccountData = vi.fn()

vi.mock('@/lib/supabase-server', () => ({ currentUser: () => currentUser() }))
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: () => ({ marker: 'admin' }) }))
vi.mock('@/lib/account-data', () => ({ exportAccountData: (...a: unknown[]) => exportAccountData(...a) }))

const { GET } = await import('@/app/studio/account/download/route')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /studio/account/download', () => {
  it('refuses without a session', async () => {
    currentUser.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(exportAccountData).not.toHaveBeenCalled()
  })

  it('streams the caller\'s export as an attachment', async () => {
    currentUser.mockResolvedValue({ id: 'user-1' })
    const payload = { exportedAt: '2026-09-22T00:00:00Z', jobs: [{ id: 'j1' }], feedback: [], credits: [], deliveries: [] }
    exportAccountData.mockResolvedValue(payload)

    const res = await GET()

    expect(exportAccountData).toHaveBeenCalledWith({ marker: 'admin' }, 'user-1')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('content-disposition')).toContain('attachment')
    expect(res.headers.get('content-disposition')).toContain('.json')
    expect(await res.json()).toEqual(payload)
  })
})
