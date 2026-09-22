import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `app/studio/account/actions.ts`. The account-data functions this delegates to (getting and
 * setting email preferences, retiring the account) are unit-tested in tests/account-data.test.ts;
 * these tests are about the session check, the type-to-confirm gate, and wiring, not the I/O.
 */
const currentUser = vi.fn()
const setEmailPreference = vi.fn()
const retireAccount = vi.fn()
const signOut = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/supabase-server', () => ({ currentUser: () => currentUser() }))
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: () => ({ marker: 'admin' }) }))
vi.mock('@/lib/account-data', () => ({
  setEmailPreference: (...a: unknown[]) => setEmailPreference(...a),
  retireAccount: (...a: unknown[]) => retireAccount(...a),
  DELETE_CONFIRM_TEXT: 'DELETE',
}))
vi.mock('@/app/studio/actions', () => ({ signOut: (...a: unknown[]) => signOut(...a) }))
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }))

const { saveEmailPreferencesForm, deleteAccountForm } = await import('@/app/studio/account/actions')
const { DELETE_CONFIRM_TEXT } = await import('@/lib/account-data')

beforeEach(() => {
  vi.clearAllMocks()
  currentUser.mockResolvedValue({ id: 'user-1' })
})

describe('saveEmailPreferencesForm', () => {
  it('refuses without a session, and touches nothing', async () => {
    currentUser.mockResolvedValueOnce(null)
    const fd = new FormData()
    const r = await saveEmailPreferencesForm(null, fd)
    expect(r.ok).toBe(false)
    expect(setEmailPreference).not.toHaveBeenCalled()
  })

  it('reads the two checkboxes as booleans and saves for the caller', async () => {
    setEmailPreference.mockResolvedValue({ ok: true })
    const fd = new FormData()
    fd.set('productEmails', 'on')
    // ratingReminders left unchecked: an unchecked checkbox sends no field at all.
    const r = await saveEmailPreferencesForm(null, fd)
    expect(setEmailPreference).toHaveBeenCalledWith(
      { marker: 'admin' },
      'user-1',
      { productEmails: true, ratingReminders: false },
    )
    expect(r).toEqual({ ok: true })
    expect(revalidatePath).toHaveBeenCalledWith('/studio/account')
  })

  it('reports a refused save without revalidating', async () => {
    setEmailPreference.mockResolvedValue({ ok: false, error: 'not available yet' })
    const r = await saveEmailPreferencesForm(null, new FormData())
    expect(r).toEqual({ ok: false, error: 'not available yet' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('deleteAccountForm', () => {
  it('refuses without a session', async () => {
    currentUser.mockResolvedValueOnce(null)
    const r = await deleteAccountForm(null, new FormData())
    expect(r.ok).toBe(false)
    expect(retireAccount).not.toHaveBeenCalled()
  })

  it('refuses when the confirm text does not match, and never retires', async () => {
    const fd = new FormData()
    fd.set('confirm', 'delete')
    const r = await deleteAccountForm(null, fd)
    expect(r.ok).toBe(false)
    expect(retireAccount).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('retires the account and signs out when the confirm text matches exactly', async () => {
    retireAccount.mockResolvedValue({ ok: true })
    const fd = new FormData()
    fd.set('confirm', DELETE_CONFIRM_TEXT)
    await deleteAccountForm(null, fd)
    expect(retireAccount).toHaveBeenCalledWith({ marker: 'admin' }, 'user-1')
    expect(signOut).toHaveBeenCalled()
  })

  it('reports a refused retirement without signing out', async () => {
    retireAccount.mockResolvedValue({ ok: false, error: 'boom' })
    const fd = new FormData()
    fd.set('confirm', DELETE_CONFIRM_TEXT)
    const r = await deleteAccountForm(null, fd)
    expect(r).toEqual({ ok: false, error: 'boom' })
    expect(signOut).not.toHaveBeenCalled()
  })
})
