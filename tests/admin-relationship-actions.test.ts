import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ADMIN_OK, BREAK_GLASS_OK, NO_SESSION } from './admin-gate-fixtures'

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

const requireAdmin = vi.fn()
vi.mock('@/lib/admin-session', () => ({
  requireAdmin: () => requireAdmin(),
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
  requireAdmin.mockResolvedValue(ADMIN_OK)
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
    requireAdmin.mockResolvedValue(NO_SESSION)
    await expect(
      updateRelationship(form({ enquiryId: 'e1', relStatus: 'signed' })),
    ).rejects.toThrow('REDIRECT:/admin')
    expect(setRelationshipStatus).not.toHaveBeenCalled()
  })
})

describe('addRelationshipNote', () => {
  it('writes a note scoped to exactly the given enquiry', async () => {
    await addRelationshipNote(form({ enquiryId: 'e1', body: 'Followed up' }))
    expect(addNote).toHaveBeenCalledWith({ enquiryId: 'e1', body: 'Followed up', author: 'info@lyricalglobal.com' })
  })

  it('REFUSES without an admin session', async () => {
    requireAdmin.mockResolvedValue(NO_SESSION)
    await expect(addRelationshipNote(form({ enquiryId: 'e1', body: 'x' }))).rejects.toThrow(
      'REDIRECT:/admin',
    )
    expect(addNote).not.toHaveBeenCalled()
  })
})

describe('addRelationshipTask', () => {
  it('writes a task scoped to exactly the given enquiry', async () => {
    await addRelationshipTask(form({ enquiryId: 'e1', title: 'Send contract' }))
    expect(addTask).toHaveBeenCalledWith({
      enquiryId: 'e1',
      title: 'Send contract',
      owner: 'info@lyricalglobal.com',
    })
  })
})

describe('author and owner default to the signed-in admin', () => {
  it('a blank owner on a status save becomes the admin email', async () => {
    await updateRelationship(form({ enquiryId: 'e1', relStatus: 'contacted', relOwner: '  ' }))
    expect(setRelationshipStatus).toHaveBeenCalledWith('e1', 'contacted', 'info@lyricalglobal.com')
  })

  it('a typed owner is kept as typed', async () => {
    await updateRelationship(form({ enquiryId: 'e1', relStatus: 'contacted', relOwner: 'Coffey' }))
    expect(setRelationshipStatus).toHaveBeenCalledWith('e1', 'contacted', 'Coffey')
  })

  it('a break-glass session has no email, so nothing is stamped', async () => {
    requireAdmin.mockResolvedValue(BREAK_GLASS_OK)
    await updateRelationship(form({ enquiryId: 'e1', relStatus: 'contacted' }))
    expect(setRelationshipStatus).toHaveBeenCalledWith('e1', 'contacted', undefined)
    await addRelationshipNote(form({ enquiryId: 'e1', body: 'x' }))
    expect(addNote).toHaveBeenCalledWith({ enquiryId: 'e1', body: 'x', author: undefined })
  })
})
