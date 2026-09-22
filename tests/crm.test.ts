import { describe, expect, it, vi } from 'vitest'
import { addNote, addTask, completeTask, listNotes, listTasks } from '@/lib/crm'

/**
 * `lib/crm.ts`: the one place `crm_*` writes happen. Every write here is service-role and
 * zod-validated; these tests exercise the validation and the exact table/column names, with a
 * fake admin client injected rather than going through `supabaseAdmin()`.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const ENQUIRY_ID = '22222222-2222-4222-8222-222222222222'

describe('addNote', () => {
  it('inserts into crm_notes scoped to the given user only', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn().mockReturnValue({ insert })
    await addNote({ userId: USER_ID, body: 'Called them back' }, { from } as never)
    expect(from).toHaveBeenCalledWith('crm_notes')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, enquiry_id: null, body: 'Called them back' }),
    )
  })

  it('inserts into crm_notes scoped to the given enquiry only', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn().mockReturnValue({ insert })
    await addNote({ enquiryId: ENQUIRY_ID, body: 'Followed up' }, { from } as never)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null, enquiry_id: ENQUIRY_ID }),
    )
  })

  it('rejects a note with neither a user nor an enquiry', async () => {
    const from = vi.fn()
    await expect(addNote({ body: 'Orphan note' }, { from } as never)).rejects.toThrow()
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects an empty body', async () => {
    const from = vi.fn()
    await expect(addNote({ userId: USER_ID, body: '' }, { from } as never)).rejects.toThrow()
    expect(from).not.toHaveBeenCalled()
  })

  it('throws on a database error rather than swallowing it', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    const from = vi.fn().mockReturnValue({ insert })
    await expect(addNote({ userId: USER_ID, body: 'x' }, { from } as never)).rejects.toThrow('boom')
  })
})

describe('listNotes', () => {
  it('filters by user_id when given a userId', async () => {
    const eq = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn().mockReturnValue({ eq })
    const select = vi.fn().mockReturnValue({ order })
    const from = vi.fn().mockReturnValue({ select })
    await listNotes({ userId: 'u1' }, { from } as never)
    expect(eq).toHaveBeenCalledWith('user_id', 'u1')
  })

  it('filters by enquiry_id when given an enquiryId', async () => {
    const eq = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn().mockReturnValue({ eq })
    const select = vi.fn().mockReturnValue({ order })
    const from = vi.fn().mockReturnValue({ select })
    await listNotes({ enquiryId: 'e1' }, { from } as never)
    expect(eq).toHaveBeenCalledWith('enquiry_id', 'e1')
  })
})

describe('addTask', () => {
  it('inserts into crm_tasks scoped to the given user', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn().mockReturnValue({ insert })
    await addTask({ userId: USER_ID, title: 'Follow up next week' }, { from } as never)
    expect(from).toHaveBeenCalledWith('crm_tasks')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, enquiry_id: null, title: 'Follow up next week' }),
    )
  })

  it('rejects a task with no title', async () => {
    const from = vi.fn()
    await expect(addTask({ userId: USER_ID, title: '' }, { from } as never)).rejects.toThrow()
  })
})

describe('listTasks', () => {
  it('filters to open tasks only when asked', async () => {
    const is = vi.fn().mockResolvedValue({ data: [], error: null })
    const eq = vi.fn().mockReturnValue({ is })
    const order = vi.fn().mockReturnValue({ eq })
    const select = vi.fn().mockReturnValue({ order })
    const from = vi.fn().mockReturnValue({ select })
    await listTasks({ userId: 'u1', openOnly: true }, { from } as never)
    expect(is).toHaveBeenCalledWith('done_at', null)
  })
})

describe('completeTask', () => {
  it('stamps done_at on exactly the given task', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ update })
    await completeTask('task-1', { from } as never)
    expect(from).toHaveBeenCalledWith('crm_tasks')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ done_at: expect.any(String) }))
    expect(eq).toHaveBeenCalledWith('id', 'task-1')
  })
})
