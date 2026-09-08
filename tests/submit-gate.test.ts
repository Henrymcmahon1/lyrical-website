import { describe, it, expect, vi, beforeEach } from 'vitest'

const quotaStatus = vi.fn()
vi.mock('@/lib/quota', () => ({ quotaStatus: (id: string) => quotaStatus(id) }))

const { assertEntitled } = await import('@/lib/submit-gate')

beforeEach(() => quotaStatus.mockReset())

describe('assertEntitled', () => {
  it('allows an entitled user', async () => {
    quotaStatus.mockResolvedValue({ entitled: true })
    expect(await assertEntitled('u1')).toEqual({ ok: true })
  })

  it('blocks when not entitled, with an upgrade message', async () => {
    quotaStatus.mockResolvedValue({ entitled: false })
    const res = await assertEntitled('u1')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/pricing/i)
  })
})
