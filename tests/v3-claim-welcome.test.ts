import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * The ONE rule for "is this somebody's first sign-in", shared by the code path, the Google
 * path, and the old magic-link path they replace. Keyed off `profiles.welcomed_at is null`
 * rather than "does the profiles row exist", because a row can now exist before a first welcome
 * (e.g. re-run migrations, or a future flow that creates the profile early) and the old
 * `ignoreDuplicates` insert trick would then never fire again for that account.
 */

const mailCustomer = vi.fn()
vi.mock('@/lib/mailer', () => ({ mailCustomer: (...a: unknown[]) => mailCustomer(...a) }))

const { claimWelcomeOnce } = await import('@/lib/claim-welcome')

function fakeSupabase(opts: { updateData: unknown; updateError?: unknown; upsertError?: unknown }) {
  const upsert = vi.fn().mockResolvedValue({ error: opts.upsertError ?? null })
  const select = vi.fn().mockResolvedValue({ data: opts.updateData, error: opts.updateError ?? null })
  const is = vi.fn(() => ({ select }))
  const eq = vi.fn(() => ({ is }))
  const update = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ upsert, update }))
  return { from: from as never, upsert, update, eq, is, select }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('claimWelcomeOnce', () => {
  it('claims the welcome once (row updated) and sends it', async () => {
    const supabase = fakeSupabase({ updateData: [{ id: 'user-1' }] })
    const claimed = await claimWelcomeOnce(supabase, 'user-1', 'artist@label.example')
    expect(claimed).toBe(true)
    expect(mailCustomer).toHaveBeenCalledOnce()
    expect(mailCustomer.mock.calls[0][1]).toBe('welcome')
    expect(mailCustomer.mock.calls[0][0].to).toBe('artist@label.example')
  })

  it('ensures the profile row exists first (upsert, ignoreDuplicates), before the conditional update', async () => {
    const supabase = fakeSupabase({ updateData: [{ id: 'user-1' }] })
    await claimWelcomeOnce(supabase, 'user-1', 'artist@label.example')
    expect(supabase.upsert).toHaveBeenCalledWith({ id: 'user-1' }, { onConflict: 'id', ignoreDuplicates: true })
  })

  it('only ever updates rows where welcomed_at is still null', async () => {
    const supabase = fakeSupabase({ updateData: [{ id: 'user-1' }] })
    await claimWelcomeOnce(supabase, 'user-1', 'artist@label.example')
    expect(supabase.eq).toHaveBeenCalledWith('id', 'user-1')
    expect(supabase.is).toHaveBeenCalledWith('welcomed_at', null)
  })

  it('does nothing on a second call: no rows updated, no welcome sent', async () => {
    const supabase = fakeSupabase({ updateData: [] })
    const claimed = await claimWelcomeOnce(supabase, 'user-1', 'artist@label.example')
    expect(claimed).toBe(false)
    expect(mailCustomer).not.toHaveBeenCalled()
  })

  it('never throws on a database error; treats it as not claimed', async () => {
    const supabase = fakeSupabase({ updateData: null, updateError: { message: 'db down' } })
    await expect(claimWelcomeOnce(supabase, 'user-1', 'artist@label.example')).resolves.toBe(false)
    expect(mailCustomer).not.toHaveBeenCalled()
  })

  it('does not mail when there is no email address, even if claimed', async () => {
    const supabase = fakeSupabase({ updateData: [{ id: 'user-1' }] })
    const claimed = await claimWelcomeOnce(supabase, 'user-1', null)
    expect(claimed).toBe(true)
    expect(mailCustomer).not.toHaveBeenCalled()
  })
})
