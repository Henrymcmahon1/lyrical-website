import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Correcting a lyric sheet after submitting.
 *
 * The interesting half is what this action CANNOT do. Until 2026-08-12 a submitted job was
 * frozen: `song_jobs` had no customer update policy at all. Opening one column is a real
 * loosening, so these pin the shape of it.
 *
 * ⚠️ The database is the control, not this function. `grant update (lyrics)` is the only update
 * privilege the `authenticated` role holds on the table, and `song_jobs_own_lyrics_update`
 * restricts the rows. A unit test cannot prove either, so what it proves instead is that the
 * action does not paper over a refusal, which is the failure a customer would actually see.
 */

const update = vi.fn()
const eqChain = vi.fn()
const selectAfter = vi.fn()
const from = vi.fn()
const currentUser = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: async () => ({ from: (...a: unknown[]) => from(...a) }),
  currentUser: () => currentUser(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { updateLyrics } = await import('@/app/studio/lyrics-actions')

const form = (entries: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

const JOB = '11111111-2222-3333-4444-555555555555'

beforeEach(() => {
  vi.clearAllMocks()
  currentUser.mockResolvedValue({ id: 'user-1', email: 'a@b.example' })

  selectAfter.mockResolvedValue({ data: [{ id: JOB }], error: null })
  const chain = {
    eq: (...a: unknown[]) => {
      eqChain(...a)
      return chain
    },
    select: (...a: unknown[]) => selectAfter(...a),
  }
  update.mockReturnValue(chain)
  from.mockReturnValue({ update: (...a: unknown[]) => update(...a) })
})

describe('who may save', () => {
  it('refuses without a session and touches nothing', async () => {
    currentUser.mockResolvedValue(null)
    const result = await updateLyrics(form({ jobId: JOB, lyrics: 'hello' }))
    expect(result.ok).toBe(false)
    expect(from).not.toHaveBeenCalled()
  })

  it('refuses an id that is not an id', async () => {
    for (const bad of ['', 'x', '../../etc', '1']) {
      const result = await updateLyrics(form({ jobId: bad, lyrics: 'hello' }))
      expect(result.ok).toBe(false)
    }
    expect(from).not.toHaveBeenCalled()
  })
})

describe('what is written', () => {
  it('writes ONLY the lyrics column', async () => {
    /**
     * The column grant is what actually enforces this, but a second field creeping into this
     * object is how somebody would later discover the grant blocking a write they expected to
     * work. Pinned so the action and the grant stay in agreement.
     */
    await updateLyrics(form({ jobId: JOB, lyrics: 'one\ntwo' }))
    expect(Object.keys(update.mock.calls[0][0] as object)).toEqual(['lyrics'])
  })

  it('normalises before saving, so the queue reads what the pipeline reads', async () => {
    await updateLyrics(form({ jobId: JOB, lyrics: '﻿one   \r\ntwo\r\n\r\n\r\n\r\nthree' }))
    expect((update.mock.calls[0][0] as { lyrics: string }).lyrics).toBe('one\ntwo\n\nthree')
  })

  it('stores null rather than an empty string when cleared', async () => {
    // An empty string and "no lyrics" are the same fact, and two representations of one fact
    // means every reader has to check for both.
    await updateLyrics(form({ jobId: JOB, lyrics: '   \n  ' }))
    expect((update.mock.calls[0][0] as { lyrics: string | null }).lyrics).toBeNull()
  })

  it('scopes the write to this job AND to a job still waiting on us', async () => {
    await updateLyrics(form({ jobId: JOB, lyrics: 'hello' }))
    expect(eqChain).toHaveBeenCalledWith('id', JOB)
    expect(eqChain).toHaveBeenCalledWith('status', 'submitted')
  })

  it('refuses a sheet longer than the ceiling', async () => {
    const result = await updateLyrics(form({ jobId: JOB, lyrics: 'x'.repeat(20001) }))
    expect(result.ok).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })
})

describe('when the job has already been accepted', () => {
  it('says so rather than reporting a save that did not happen', async () => {
    /**
     * The failure this prevents is silent. A write blocked by RLS returns zero rows and no
     * error, which is indistinguishable from a successful no-op, so without this the customer
     * would be told their correction saved when it did not and would find out from the output.
     */
    selectAfter.mockResolvedValue({ data: [], error: null })
    const result = await updateLyrics(form({ jobId: JOB, lyrics: 'hello' }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/already been accepted/i)
  })
})
