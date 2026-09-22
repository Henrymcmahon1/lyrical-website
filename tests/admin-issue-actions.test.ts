import { describe, expect, it, vi, beforeEach } from 'vitest'

/** The Issues tab's write actions: log an issue, change its status. */

const logIssue = vi.fn()
const setIssueStatus = vi.fn()
vi.mock('@/lib/crm', async () => {
  const actual = await vi.importActual<typeof import('@/lib/crm')>('@/lib/crm')
  return {
    ...actual,
    logIssue: (...a: unknown[]) => logIssue(...a),
    setIssueStatus: (...a: unknown[]) => setIssueStatus(...a),
  }
})

const hasAdminSession = vi.fn()
vi.mock('@/lib/admin-session', () => ({
  hasAdminSession: () => hasAdminSession(),
}))

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

const { createIssue, changeIssueStatus } = await import('@/app/admin/issue-actions')

const form = (entries: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  hasAdminSession.mockResolvedValue(true)
})

describe('createIssue', () => {
  it('logs an issue with the given fields', async () => {
    await createIssue(form({ kind: 'failed_job', jobId: 'job-1', detail: 'stems expired' }))
    expect(logIssue).toHaveBeenCalledWith({
      jobId: 'job-1',
      userId: undefined,
      kind: 'failed_job',
      detail: 'stems expired',
    })
  })

  it('rejects an unknown kind without writing', async () => {
    await createIssue(form({ kind: 'not_a_kind' }))
    expect(logIssue).not.toHaveBeenCalled()
  })

  it('REFUSES without an admin session', async () => {
    hasAdminSession.mockResolvedValue(false)
    await expect(createIssue(form({ kind: 'other' }))).rejects.toThrow('REDIRECT:/admin')
    expect(logIssue).not.toHaveBeenCalled()
  })
})

describe('changeIssueStatus', () => {
  it('sets the status on exactly the given issue', async () => {
    await changeIssueStatus(form({ id: 'i1', status: 'resolved' }))
    expect(setIssueStatus).toHaveBeenCalledWith('i1', 'resolved')
  })

  it('rejects an unknown status without writing', async () => {
    await changeIssueStatus(form({ id: 'i1', status: 'nope' }))
    expect(setIssueStatus).not.toHaveBeenCalled()
  })
})
