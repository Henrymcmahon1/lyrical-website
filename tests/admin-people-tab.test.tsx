import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * The People tab: every account, their plan, their sign-in method, and staff notes/tasks
 * against them. `getBillingSummary` and `lib/crm.ts`'s reads are exercised for real (not
 * mocked away) against a stubbed Supabase client, so this also proves the join actually lines
 * up: a note added against one user must never show up on another user's row.
 */

const listUsers = vi.fn()
const from = vi.fn()

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    auth: { admin: { listUsers: (...a: unknown[]) => listUsers(...a) } },
    from: (...a: unknown[]) => from(...a),
  }),
}))

const USER_A = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@label.example', last_sign_in_at: '2026-09-20T10:00:00Z', identities: [{ provider: 'email' }] }
const USER_B = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'b@label.example', last_sign_in_at: null, identities: [{ provider: 'google' }] }

const NOTE_A = { id: 'n1', created_at: '2026-09-21T00:00:00Z', author: null, user_id: USER_A.id, enquiry_id: null, body: 'Called A back' }
const TASK_A = { id: 't1', created_at: '2026-09-21T00:00:00Z', user_id: USER_A.id, enquiry_id: null, title: 'Follow up with A', due_on: '2026-09-25', owner: null, done_at: null }

function wireData() {
  from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return { select: () => Promise.resolve({ data: [], error: null }) }
    }
    if (table === 'subscriptions') {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }
    }
    if (table === 'song_credits') {
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }
    }
    if (table === 'crm_notes') {
      const chain = {
        select: () => chain,
        order: () => chain,
        eq: (col: string, val: string) =>
          Promise.resolve({ data: col === 'user_id' && val === USER_A.id ? [NOTE_A] : [], error: null }),
      }
      return chain
    }
    if (table === 'crm_tasks') {
      const chain = {
        select: () => chain,
        order: () => chain,
        eq: (col: string, val: string) => ({
          is: () => Promise.resolve({ data: col === 'user_id' && val === USER_A.id ? [TASK_A] : [], error: null }),
        }),
      }
      return chain
    }
    throw new Error(`unexpected table ${table}`)
  })
  listUsers.mockResolvedValue({ data: { users: [USER_A, USER_B] }, error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  wireData()
})

describe('PeopleTab', () => {
  it('draws one row per account', async () => {
    const { PeopleTab } = await import('@/app/admin/PeopleTab')
    const html = renderToStaticMarkup(await PeopleTab())
    expect(html).toContain('a@label.example')
    expect(html).toContain('b@label.example')
    expect(html).toContain('2 accounts')
  })

  it('shows a note only on the account it belongs to', async () => {
    const { PeopleTab } = await import('@/app/admin/PeopleTab')
    const html = renderToStaticMarkup(await PeopleTab())
    const aIndex = html.indexOf('a@label.example')
    const bIndex = html.indexOf('b@label.example')
    const noteIndex = html.indexOf('Called A back')
    expect(noteIndex).toBeGreaterThan(aIndex)
    expect(noteIndex).toBeLessThan(bIndex)
  })

  it('shows the sign-in method per account', async () => {
    const { PeopleTab } = await import('@/app/admin/PeopleTab')
    const html = renderToStaticMarkup(await PeopleTab())
    expect(html).toContain('email code')
    expect(html).toContain('google')
  })

  it('shows an open next action', async () => {
    const { PeopleTab } = await import('@/app/admin/PeopleTab')
    const html = renderToStaticMarkup(await PeopleTab())
    expect(html).toContain('Follow up with A')
  })
})
