import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_OK, BREAK_GLASS_OK, REFUSALS } from './admin-gate-fixtures'

/**
 * GET /admin/door1/download?delivery=<id>: a 60 second signed URL from the private `door1`
 * bucket, minted per click after `requireAdmin()`. The path comes from the database, never the
 * query string, and only for a delivery of a Door 1 job.
 */

const requireAdmin = vi.fn()
vi.mock('@/lib/admin-session', () => ({ requireAdmin: () => requireAdmin() }))

const DELIVERY_ID = '44444444-4444-4444-8444-444444444444'
const JOB_ID = '22222222-2222-4222-8222-222222222222'

let delivery: Record<string, unknown> | null
let job: Record<string, unknown> | null
const createSignedUrl = vi.fn()
const from = vi.fn()

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      from(table)
      const row = table === 'song_job_deliveries' ? delivery : job
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: row, error: null }),
      }
      return chain
    },
    storage: { from: (bucket: string) => ({ createSignedUrl: (...a: unknown[]) => createSignedUrl(bucket, ...a) }) },
  }),
}))

const { GET } = await import('@/app/admin/door1/download/route')

const get = (q: string) => GET(new Request(`https://x.test/admin/door1/download?${q}`))

beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue(ADMIN_OK)
  delivery = { job_id: JOB_ID, path: `${JOB_ID}/vocal.flac`, filename: 'vocal.flac', purged_at: null }
  job = { id: JOB_ID, delivery_profile: 'door1', title: 'Sweet Home' }
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://storage.test/signed' }, error: null })
})

describe('signing', () => {
  it('redirects to a 60 second signed URL from the door1 bucket, never cached', async () => {
    const res = await get(`delivery=${DELIVERY_ID}`)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://storage.test/signed')
    expect(res.headers.get('cache-control')).toMatch(/no-store/)
    expect(createSignedUrl).toHaveBeenCalledWith('door1', `${JOB_ID}/vocal.flac`, 60, {
      download: expect.stringMatching(/\.flac$/),
    })
  })

  it('allows a break-glass session (read-only)', async () => {
    requireAdmin.mockResolvedValue(BREAK_GLASS_OK)
    expect((await get(`delivery=${DELIVERY_ID}`)).status).toBe(307)
  })

  it('410 for a purged delivery, and signs nothing', async () => {
    delivery = { ...delivery, purged_at: '2026-10-01T00:00:00Z' }
    const res = await get(`delivery=${DELIVERY_ID}`)
    expect(res.status).toBe(410)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('404 for a Door 2 delivery: this route signs Door 1 only', async () => {
    job = { id: JOB_ID, delivery_profile: 'door2', title: 'x' }
    expect((await get(`delivery=${DELIVERY_ID}`)).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('404 for a path outside the job folder', async () => {
    delivery = { ...delivery, path: 'someone/else.flac' }
    expect((await get(`delivery=${DELIVERY_ID}`)).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('404 for an unknown or malformed id', async () => {
    delivery = null
    expect((await get(`delivery=${DELIVERY_ID}`)).status).toBe(404)
    expect((await get('delivery=../../x')).status).toBe(404)
    expect((await get('path=x')).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('502 when storage refuses to sign', async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect((await get(`delivery=${DELIVERY_ID}`)).status).toBe(502)
  })
})

describe.each(REFUSALS)('refused: %s', (_l, check) => {
  it('404 and reads nothing', async () => {
    requireAdmin.mockResolvedValue(check)
    const res = await get(`delivery=${DELIVERY_ID}`)
    expect(res.status).toBe(404)
    expect(from).not.toHaveBeenCalled()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
