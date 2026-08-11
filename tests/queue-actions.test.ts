import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The `/queue` server actions, and specifically the things that are easy to get wrong.
 *
 * A server action is a POST endpoint like any other. Reaching it does not require having
 * rendered the page, so the page's own sign-in check protects nothing here. If the guard inside
 * an action is ever dropped, anybody who knows the endpoint exists can delete a stranger's
 * enquiry or accept a job on our behalf, and no test elsewhere would notice.
 *
 * Two actions carry real consequences and get the most attention:
 *
 *   `deleteLead` is irreversible.
 *   `moveJob` starts a delivery clock and emails a promise to a customer.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

const del = vi.fn()
const eqDelete = vi.fn()
const update = vi.fn()
const eqChain = vi.fn()
const selectAfterUpdate = vi.fn()
const from = vi.fn()
const getUserById = vi.fn()

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: (...a: unknown[]) => from(...a),
    auth: { admin: { getUserById: (...a: unknown[]) => getUserById(...a) } },
  }),
}))

const mailCustomer = vi.fn()
vi.mock('@/lib/mailer', () => ({
  mailCustomer: (...a: unknown[]) => mailCustomer(...a),
  mailFounders: vi.fn(),
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

const { deleteLead, moveJob } = await import('@/app/queue/actions')

const form = (entries: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

const JOB_ROW = {
  id: 'job-1',
  title: 'A Song',
  primary_artist: 'An Artist',
  source_language: 'EN',
  target_language: 'ES',
  user_id: 'user-1',
}

beforeEach(() => {
  vi.clearAllMocks()

  // Enquiry delete: from('enquiries').delete().eq('id', ...)
  eqDelete.mockResolvedValue({ error: null })
  del.mockReturnValue({ eq: (...a: unknown[]) => eqDelete(...a) })

  // Song move: from('song_jobs').update({...}).eq(...).eq(...).select(...)
  selectAfterUpdate.mockResolvedValue({ data: [JOB_ROW], error: null })
  const chain = {
    eq: (...a: unknown[]) => {
      eqChain(...a)
      return chain
    },
    select: (...a: unknown[]) => selectAfterUpdate(...a),
  }
  update.mockReturnValue(chain)

  from.mockImplementation((table: string) =>
    table === 'enquiries'
      ? { delete: (...a: unknown[]) => del(...a) }
      : { update: (...a: unknown[]) => update(...a) },
  )

  getUserById.mockResolvedValue({ data: { user: { email: 'artist@label.example' } }, error: null })
  mailCustomer.mockResolvedValue(true)
  hasAdminSession.mockResolvedValue(true)
})

/** Runs an action and returns where it redirected, or null if it did not. */
async function run(fn: (fd: FormData) => Promise<unknown>, fd: FormData): Promise<string | null> {
  try {
    await fn(fd)
    return null
  } catch (e) {
    if (e instanceof RedirectError) return e.to
    throw e
  }
}

// ── Enquiries ─────────────────────────────────────────────────────────────────

describe('deleteLead', () => {
  it('deletes the row it was given', async () => {
    await run(deleteLead, form({ id: 'abc-123' }))
    expect(from).toHaveBeenCalledWith('enquiries')
    expect(eqDelete).toHaveBeenCalledWith('id', 'abc-123')
  })

  it('REFUSES without an admin session, and touches nothing', async () => {
    hasAdminSession.mockResolvedValue(false)
    const to = await run(deleteLead, form({ id: 'abc-123' }))
    expect(to).toBe('/queue')
    // The important half: not merely redirected, but no delete was issued.
    expect(from).not.toHaveBeenCalled()
    expect(eqDelete).not.toHaveBeenCalled()
  })

  it('does nothing when no id was supplied', async () => {
    await run(deleteLead, form({}))
    expect(from).not.toHaveBeenCalled()
  })

  it('redirects away afterwards, so a refresh cannot repeat it', async () => {
    expect(await run(deleteLead, form({ id: 'abc-123' }))).toBe(
      '/queue?tab=enquiries&deleted=1',
    )
  })

  it('keeps the caller on the view they were looking at', async () => {
    expect(await run(deleteLead, form({ id: 'abc-123', show: 'all' }))).toBe(
      '/queue?tab=enquiries&show=all&deleted=1',
    )
  })
})

// ── Songs ─────────────────────────────────────────────────────────────────────

describe('moveJob: the guard', () => {
  it('REFUSES without an admin session, and writes nothing', async () => {
    hasAdminSession.mockResolvedValue(false)
    const to = await run(moveJob, form({ id: 'job-1', from: 'submitted', to: 'approved' }))
    expect(to).toBe('/queue')
    expect(from).not.toHaveBeenCalled()
    expect(mailCustomer).not.toHaveBeenCalled()
  })

  it('refuses a move the lifecycle does not allow, even when posted directly', async () => {
    // Straight from submitted to delivered skips acceptance, which is where the clock and the
    // promise come from. The buttons never offer it; this proves the server does not either.
    const to = await run(moveJob, form({ id: 'job-1', from: 'submitted', to: 'delivered' }))
    expect(to).toBe('/queue?error=move')
    expect(update).not.toHaveBeenCalled()
    expect(mailCustomer).not.toHaveBeenCalled()
  })

  it('refuses to reopen a finished job', async () => {
    const to = await run(moveJob, form({ id: 'job-1', from: 'delivered', to: 'in_progress' }))
    expect(to).toBe('/queue?error=move')
    expect(update).not.toHaveBeenCalled()
  })

  it('refuses a status that is not a status at all', async () => {
    const to = await run(moveJob, form({ id: 'job-1', from: 'submitted', to: 'anything' }))
    expect(to).toBe('/queue?error=move')
    expect(update).not.toHaveBeenCalled()
  })
})

describe('moveJob: accepting', () => {
  it('stamps approved_at, because that is when the clock starts', async () => {
    await run(moveJob, form({ id: 'job-1', from: 'submitted', to: 'approved' }))
    const written = update.mock.calls[0][0] as Record<string, string>
    expect(written.status).toBe('approved')
    expect(written.approved_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(written.delivered_at).toBeUndefined()
  })

  it('only writes over the status it was told the job was in', async () => {
    /**
     * Two founders looking at the queue is the normal case. Without this condition, one
     * clicking Accept and the other clicking Reject produces two successful writes and two
     * contradictory emails, and the customer believes whichever landed second.
     */
    await run(moveJob, form({ id: 'job-1', from: 'submitted', to: 'approved' }))
    expect(eqChain).toHaveBeenCalledWith('id', 'job-1')
    expect(eqChain).toHaveBeenCalledWith('status', 'submitted')
  })

  it('emails the customer that it has been taken on', async () => {
    await run(moveJob, form({ id: 'job-1', from: 'submitted', to: 'approved' }))
    expect(mailCustomer).toHaveBeenCalledTimes(1)
    const [mail, label] = mailCustomer.mock.calls[0]
    expect(label).toBe('job-accepted')
    expect(mail.to).toBe('artist@label.example')
    expect(mail.subject).toContain('taken on')
  })

  it('says nothing at all when the row had already moved', async () => {
    selectAfterUpdate.mockResolvedValue({ data: [], error: null })
    const to = await run(moveJob, form({ id: 'job-1', from: 'submitted', to: 'approved' }))
    expect(to).toBe('/queue?error=stale')
    // The point of the whole guard: no second acceptance email.
    expect(mailCustomer).not.toHaveBeenCalled()
  })
})

describe('moveJob: rejecting is silent, on purpose', () => {
  it('writes the status and sends NOTHING', async () => {
    /**
     * Henry's decision, taken with the trade-off in front of him. It is asserted here so that a
     * later session cannot add a rejection email as a kindness without first changing this
     * test, which is where the decision is written down.
     */
    const to = await run(moveJob, form({ id: 'job-1', from: 'submitted', to: 'rejected' }))
    expect(to).toBe('/queue?moved=rejected')
    expect((update.mock.calls[0][0] as Record<string, string>).status).toBe('rejected')
    expect(mailCustomer).not.toHaveBeenCalled()
  })
})

describe('moveJob: the quiet middle step', () => {
  it('starting work tells nobody', async () => {
    // There is nothing for the customer to do with this, and an email per internal step trains
    // people to stop opening them.
    await run(moveJob, form({ id: 'job-1', from: 'approved', to: 'in_progress' }))
    expect(mailCustomer).not.toHaveBeenCalled()
  })
})

describe('moveJob: delivering', () => {
  it('stamps delivered_at and emails that it is ready', async () => {
    await run(moveJob, form({ id: 'job-1', from: 'in_progress', to: 'delivered' }))
    const written = update.mock.calls[0][0] as Record<string, string>
    expect(written.delivered_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(mailCustomer.mock.calls[0][1]).toBe('job-delivered')
  })

  it('never puts a link to the files in that email', async () => {
    // The files are not in the portal and no signed URL is safe in an inbox. Asserted at the
    // action as well as at the template, because this is where a future "just add a link" goes.
    await run(moveJob, form({ id: 'job-1', from: 'in_progress', to: 'delivered' }))
    const [mail] = mailCustomer.mock.calls[0]
    expect(`${mail.text}${mail.html}`).not.toMatch(/submissions\/|token=|sign\/|X-Amz/i)
  })

  it('still records the move when the customer has no readable address', async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: null })
    const to = await run(moveJob, form({ id: 'job-1', from: 'in_progress', to: 'delivered' }))
    expect(to).toBe('/queue?moved=delivered')
    expect(mailCustomer).not.toHaveBeenCalled()
  })
})
