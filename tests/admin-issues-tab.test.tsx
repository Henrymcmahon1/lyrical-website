import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/** The Issues tab: crm_issues, filterable by status, the heartbeat age, and the storage note. */

const from = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ from: (...a: unknown[]) => from(...a) }),
}))

const ISSUE = {
  id: 'i1',
  created_at: '2026-09-22T00:00:00Z',
  job_id: 'job-1',
  user_id: null,
  kind: 'failed_job',
  status: 'open',
  detail: 'stems expired',
  resolved_at: null,
}

function wire(heartbeats: unknown[]) {
  from.mockImplementation((table: string) => {
    if (table === 'crm_issues') {
      const chain = {
        select: () => chain,
        order: () => chain,
        eq: () => Promise.resolve({ data: [ISSUE], error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: [ISSUE], error: null }),
      }
      return chain
    }
    if (table === 'worker_heartbeat') {
      return { select: () => Promise.resolve({ data: heartbeats, error: null }) }
    }
    throw new Error(`unexpected table ${table}`)
  })
}

beforeEach(() => vi.clearAllMocks())

describe('IssuesTab', () => {
  it('shows an open issue with its detail', async () => {
    wire([])
    const { IssuesTab } = await import('@/app/admin/IssuesTab')
    const html = renderToStaticMarkup(await IssuesTab())
    expect(html).toContain('Failed job')
    expect(html).toContain('stems expired')
  })

  it('flags a stale heartbeat', async () => {
    const staleSeenAt = new Date(Date.now() - 30 * 60000).toISOString()
    wire([{ worker: 'optiplex', seen_at: staleSeenAt, version: 'abc123' }])
    const { IssuesTab } = await import('@/app/admin/IssuesTab')
    const html = renderToStaticMarkup(await IssuesTab())
    expect(html).toContain('paused')
  })

  it('shows a fresh heartbeat as running', async () => {
    const freshSeenAt = new Date(Date.now() - 2 * 60000).toISOString()
    wire([{ worker: 'optiplex', seen_at: freshSeenAt, version: 'abc123' }])
    const { IssuesTab } = await import('@/app/admin/IssuesTab')
    const html = renderToStaticMarkup(await IssuesTab())
    expect(html).toContain('running')
  })

  it('shows the storage figure as best-effort', async () => {
    wire([])
    const { IssuesTab } = await import('@/app/admin/IssuesTab')
    const html = renderToStaticMarkup(await IssuesTab())
    expect(html).toContain('Best-effort')
  })
})
