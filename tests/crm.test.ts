import { describe, expect, it, vi } from 'vitest'
import {
  addNote,
  addTask,
  completeTask,
  listNotes,
  listTasks,
  logIssue,
  listIssues,
  setIssueStatus,
  setRelationshipStatus,
} from '@/lib/crm'

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

const JOB_ID = '33333333-3333-4333-8333-333333333333'

describe('logIssue', () => {
  it('inserts into crm_issues with status defaulted by the database (not sent here)', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn().mockReturnValue({ insert })
    await logIssue({ jobId: JOB_ID, kind: 'failed_job', detail: 'stems expired' }, { from } as never)
    expect(from).toHaveBeenCalledWith('crm_issues')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ job_id: JOB_ID, user_id: null, kind: 'failed_job', detail: 'stems expired' }),
    )
  })

  it('rejects an unknown kind', async () => {
    const from = vi.fn()
    await expect(
      logIssue({ jobId: JOB_ID, kind: 'not_a_real_kind' as never }, { from } as never),
    ).rejects.toThrow()
    expect(from).not.toHaveBeenCalled()
  })
})

describe('listIssues', () => {
  it('filters by status when given one', async () => {
    const eq = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn().mockReturnValue({ eq })
    const select = vi.fn().mockReturnValue({ order })
    const from = vi.fn().mockReturnValue({ select })
    await listIssues({ status: 'open' }, { from } as never)
    expect(eq).toHaveBeenCalledWith('status', 'open')
  })
})

describe('setIssueStatus', () => {
  it('stamps resolved_at when moving to resolved', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ update })
    await setIssueStatus('issue-1', 'resolved', { from } as never)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'resolved', resolved_at: expect.any(String) }),
    )
    expect(eq).toHaveBeenCalledWith('id', 'issue-1')
  })

  it('clears resolved_at when moving back to open', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ update })
    await setIssueStatus('issue-1', 'open', { from } as never)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'open', resolved_at: null }))
  })
})

describe('setRelationshipStatus', () => {
  it('writes rel_status on exactly the given enquiry', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ update })
    await setRelationshipStatus(ENQUIRY_ID, 'contacted', undefined, { from } as never)
    expect(from).toHaveBeenCalledWith('enquiries')
    expect(update).toHaveBeenCalledWith({ rel_status: 'contacted' })
    expect(eq).toHaveBeenCalledWith('id', ENQUIRY_ID)
  })

  it('also writes rel_owner when given', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ update })
    await setRelationshipStatus(ENQUIRY_ID, 'in_talks', 'Henry', { from } as never)
    expect(update).toHaveBeenCalledWith({ rel_status: 'in_talks', rel_owner: 'Henry' })
  })
})
