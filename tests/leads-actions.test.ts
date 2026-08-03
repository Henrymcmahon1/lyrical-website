import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The /leads server actions, and specifically the thing that is easy to get wrong.
 *
 * A server action is a POST endpoint like any other. Reaching it does not require having
 * rendered the page, so the page's own sign-in check protects nothing here. If the guard
 * inside the action is ever dropped, anybody who knows the endpoint exists can delete a
 * stranger's enquiry, and no test elsewhere would notice.
 *
 * `deleteLead` is irreversible, which is why it gets the most attention.
 */

const del = vi.fn()
const eq = vi.fn()
const from = vi.fn()

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ from: (...a: unknown[]) => from(...a) }),
}))

const hasAdminSession = vi.fn()
vi.mock('@/lib/admin-session', () => ({
  hasAdminSession: () => hasAdminSession(),
}))

/** Next's redirect throws to unwind the request. Mirrored so the tests can assert on it. */
class RedirectError extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`)
  }
}
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectError(to)
  },
}))

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidatePath(p) }))

vi.mock('next/headers', () => ({
  cookies: async () => ({ set: vi.fn(), get: vi.fn() }),
  headers: async () => new Headers(),
}))

const { deleteLead } = await import('@/app/leads/actions')

const form = (entries: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  del.mockReset()
  eq.mockReset()
  from.mockReset()
  revalidatePath.mockReset()
  hasAdminSession.mockReset()

  eq.mockResolvedValue({ error: null })
  del.mockReturnValue({ eq: (...a: unknown[]) => eq(...a) })
  from.mockReturnValue({ delete: (...a: unknown[]) => del(...a) })
})

/** Runs the action and returns where it redirected, or null if it did not. */
async function run(fd: FormData): Promise<string | null> {
  try {
    await deleteLead(fd)
    return null
  } catch (e) {
    if (e instanceof RedirectError) return e.to
    throw e
  }
}

describe('deleteLead', () => {
  it('deletes the row it was given', async () => {
    hasAdminSession.mockResolvedValue(true)
    await run(form({ id: 'abc-123' }))
    expect(from).toHaveBeenCalledWith('enquiries')
    expect(eq).toHaveBeenCalledWith('id', 'abc-123')
  })

  it('REFUSES without an admin session, and touches nothing', async () => {
    hasAdminSession.mockResolvedValue(false)
    const to = await run(form({ id: 'abc-123' }))
    expect(to).toBe('/leads')
    // The important half: not merely redirected, but no delete was issued.
    expect(from).not.toHaveBeenCalled()
    expect(eq).not.toHaveBeenCalled()
  })

  it('does nothing when no id was supplied', async () => {
    hasAdminSession.mockResolvedValue(true)
    await run(form({}))
    expect(from).not.toHaveBeenCalled()
  })

  it('redirects away afterwards, so a refresh cannot repeat it', async () => {
    hasAdminSession.mockResolvedValue(true)
    expect(await run(form({ id: 'abc-123' }))).toBe('/leads?deleted=1')
  })

  it('keeps the caller on the view they were looking at', async () => {
    hasAdminSession.mockResolvedValue(true)
    expect(await run(form({ id: 'abc-123', show: 'all' }))).toBe('/leads?show=all&deleted=1')
  })

  it('refreshes the cached list so the row does not linger', async () => {
    hasAdminSession.mockResolvedValue(true)
    await run(form({ id: 'abc-123' }))
    expect(revalidatePath).toHaveBeenCalledWith('/leads')
  })
})
