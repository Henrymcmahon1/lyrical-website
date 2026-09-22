import { describe, expect, it, vi, beforeEach } from 'vitest'

/** The Relationships tab's write actions: same guard discipline as every other /admin action. */

const setRelationshipStatus = vi.fn()
const addNote = vi.fn()
const addTask = vi.fn()
vi.mock('@/lib/crm', async () => {
  const actual = await vi.importActual<typeof import('@/lib/crm')>('@/lib/crm')
  return {
    ...actual,
    setRelationshipStatus: (...a: unknown[]) => setRelationshipStatus(...a),
    addNote: (...a: unknown[]) => addNote(...a),
    addTask: (...a: unknown[]) => addTask(...a),
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

const { updateRelationship, addRelationshipNote, addRelationshipTask } = await import(
  '@/app/admin/relationship-actions'
)

const form = (entries: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  hasAdminSession.mockResolvedValue(true)
})

describe('updateRelationship', () => {
  it('writes the status and owner for exactly the given enquiry', async () => {
    await updateRelationship(form({ enquiryId: 'e1', relStatus: 'signed', relOwner: 'Henry' }))
    expect(setRelationshipStatus).toHaveBeenCalledWith('e1', 'signed', 'Henry')
  })

  it('rejects an unknown status without writing', async () => {
    await updateRelationship(form({ enquiryId: 'e1', relStatus: 'not_a_status' }))
    expect(setRelationshipStatus).not.toHaveBeenCalled()
  })

  it('REFUSES without an admin session', async () => {
    hasAdminSession.mockResolvedValue(false)
    await expect(
      updateRelationship(form({ enquiryId: 'e1', relStatus: 'signed' })),
    ).rejects.toThrow('REDIRECT:/admin')
    expect(setRelationshipStatus).not.toHaveBeenCalled()
  })
})

describe('addRelationshipNote', () => {
  it('writes a note scoped to exactly the given enquiry', async () => {
    await addRelationshipNote(form({ enquiryId: 'e1', body: 'Followed up' }))
    expect(addNote).toHaveBeenCalledWith({ enquiryId: 'e1', body: 'Followed up' })
  })

  it('REFUSES without an admin session', async () => {
    hasAdminSession.mockResolvedValue(false)
    await expect(addRelationshipNote(form({ enquiryId: 'e1', body: 'x' }))).rejects.toThrow(
      'REDIRECT:/admin',
    )
    expect(addNote).not.toHaveBeenCalled()
  })
})

describe('addRelationshipTask', () => {
  it('writes a task scoped to exactly the given enquiry', async () => {
    await addRelationshipTask(form({ enquiryId: 'e1', title: 'Send contract' }))
    expect(addTask).toHaveBeenCalledWith({ enquiryId: 'e1', title: 'Send contract' })
  })
})
