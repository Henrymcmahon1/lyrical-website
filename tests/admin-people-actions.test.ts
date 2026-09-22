import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * The People tab's two write actions. Same guard discipline as every other `/admin` action:
 * re-checks the session independently of the page, because a server action is reachable without
 * ever having rendered it.
 */

const addNote = vi.fn()
const addTask = vi.fn()
vi.mock('@/lib/crm', () => ({
  addNote: (...a: unknown[]) => addNote(...a),
  addTask: (...a: unknown[]) => addTask(...a),
}))

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

const { addPersonNote, addPersonTask } = await import('@/app/admin/people-actions')

const form = (entries: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  hasAdminSession.mockResolvedValue(true)
})

describe('addPersonNote', () => {
  it('writes a note scoped to exactly the given user', async () => {
    await addPersonNote(form({ userId: 'u1', body: 'Called them back' }))
    expect(addNote).toHaveBeenCalledWith({ userId: 'u1', body: 'Called them back' })
  })

  it('REFUSES without an admin session, and writes nothing', async () => {
    hasAdminSession.mockResolvedValue(false)
    await expect(addPersonNote(form({ userId: 'u1', body: 'x' }))).rejects.toThrow('REDIRECT:/admin')
    expect(addNote).not.toHaveBeenCalled()
  })

  it('does nothing when the body is blank', async () => {
    await addPersonNote(form({ userId: 'u1', body: '  ' }))
    expect(addNote).not.toHaveBeenCalled()
  })
})

describe('addPersonTask', () => {
  it('writes a task scoped to exactly the given user', async () => {
    await addPersonTask(form({ userId: 'u1', title: 'Follow up', dueOn: '2026-10-01' }))
    expect(addTask).toHaveBeenCalledWith({ userId: 'u1', title: 'Follow up', dueOn: '2026-10-01' })
  })

  it('REFUSES without an admin session, and writes nothing', async () => {
    hasAdminSession.mockResolvedValue(false)
    await expect(addPersonTask(form({ userId: 'u1', title: 'x' }))).rejects.toThrow('REDIRECT:/admin')
    expect(addTask).not.toHaveBeenCalled()
  })

  it('does nothing when the title is blank', async () => {
    await addPersonTask(form({ userId: 'u1', title: '' }))
    expect(addTask).not.toHaveBeenCalled()
  })
})
