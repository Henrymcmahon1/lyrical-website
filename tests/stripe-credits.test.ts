import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addCredit, consumeCredit, creditBalance } from '@/lib/credits'

const insert = vi.fn()
const eq = vi.fn()
const admin = { from: vi.fn(() => ({ insert, select: () => ({ eq }) })) }

beforeEach(() => {
  insert.mockReset()
  eq.mockReset()
  admin.from.mockClear()
})

describe('credits', () => {
  it('sums delta rows for the user; a read error throws', async () => {
    eq.mockResolvedValueOnce({ data: [{ delta: 1 }, { delta: 1 }, { delta: -1 }], error: null })
    expect(await creditBalance(admin as never, 'u1')).toBe(1)
    expect(admin.from).toHaveBeenCalledWith('song_credits')
    expect(eq).toHaveBeenCalledWith('user_id', 'u1')
    eq.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(creditBalance(admin as never, 'u1')).rejects.toThrow('boom')
  })

  it('an empty ledger is a zero balance', async () => {
    eq.mockResolvedValueOnce({ data: [], error: null })
    expect(await creditBalance(admin as never, 'u1')).toBe(0)
  })

  it('addCredit writes +1 with the stripe event id', async () => {
    insert.mockResolvedValue({ error: null })
    await addCredit(admin as never, { userId: 'u1', reason: 'purchase_single', stripeEventId: 'evt_1' })
    expect(insert).toHaveBeenCalledWith({
      user_id: 'u1',
      delta: 1,
      reason: 'purchase_single',
      stripe_event_id: 'evt_1',
    })
  })

  it('addCredit throws on a write error', async () => {
    insert.mockResolvedValueOnce({ error: { message: 'duplicate' } })
    await expect(
      addCredit(admin as never, { userId: 'u1', reason: 'grant', stripeEventId: null }),
    ).rejects.toThrow('duplicate')
  })

  it('consumeCredit writes -1 against the job and reports failure as false', async () => {
    insert.mockResolvedValueOnce({ error: null })
    expect(await consumeCredit(admin as never, { userId: 'u1', jobId: 'j1' })).toBe(true)
    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', delta: -1, reason: 'consume', job_id: 'j1' })
    insert.mockResolvedValueOnce({ error: { message: 'rls' } })
    expect(await consumeCredit(admin as never, { userId: 'u1', jobId: 'j1' })).toBe(false)
  })
})
