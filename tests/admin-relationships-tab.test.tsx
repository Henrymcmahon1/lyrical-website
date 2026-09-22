import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * The Relationships tab's additions over the old EnquiriesTab: rel_status/rel_owner shown and
 * editable, plus notes and next actions per enquiry (same shape as the People tab, scoped to
 * enquiry_id instead of user_id).
 */

const from = vi.fn()

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ from: (...a: unknown[]) => from(...a) }),
}))

const LEAD = {
  id: 'lead-1',
  created_at: '2026-09-20T00:00:00Z',
  name: 'Jamie Artist',
  email: 'jamie@label.example',
  role: 'artist',
  company: null,
  catalogue_size: null,
  target_languages: null,
  message: null,
  source: 'artist_eoi',
  unlocked_audio: false,
  handled: false,
  rel_status: 'contacted',
  rel_owner: 'Henry',
}

const NOTE = { id: 'n1', created_at: '2026-09-21T00:00:00Z', author: null, user_id: null, enquiry_id: 'lead-1', body: 'Called Jamie' }
const TASK = { id: 't1', created_at: '2026-09-21T00:00:00Z', user_id: null, enquiry_id: 'lead-1', title: 'Send contract', due_on: '2026-09-30', owner: null, done_at: null }

function wire() {
  from.mockImplementation((table: string) => {
    if (table === 'enquiries') {
      const chain = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        eq: () => chain,
        then: (resolve: (v: unknown) => void) => resolve({ data: [LEAD], error: null, count: 1 }),
      }
      return chain
    }
    if (table === 'crm_notes') {
      const chain = { select: () => chain, order: () => chain, eq: () => Promise.resolve({ data: [NOTE], error: null }) }
      return chain
    }
    if (table === 'crm_tasks') {
      const chain = { select: () => chain, order: () => chain, eq: () => ({ is: () => Promise.resolve({ data: [TASK], error: null }) }) }
      return chain
    }
    throw new Error(`unexpected table ${table}`)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  wire()
})

describe('EnquiriesTab (Relationships)', () => {
  it('shows the relationship status and owner', async () => {
    const { EnquiriesTab } = await import('@/app/admin/EnquiriesTab')
    const html = renderToStaticMarkup(await EnquiriesTab({ showAll: true }))
    expect(html).toContain('selected=""')
    expect(html).toContain('Contacted')
    expect(html).toContain('value="Henry"')
  })

  it('shows the note and the open next action', async () => {
    const { EnquiriesTab } = await import('@/app/admin/EnquiriesTab')
    const html = renderToStaticMarkup(await EnquiriesTab({ showAll: true }))
    expect(html).toContain('Called Jamie')
    expect(html).toContain('Send contract')
  })

  it('carries the enquiry id in the status form', async () => {
    const { EnquiriesTab } = await import('@/app/admin/EnquiriesTab')
    const html = renderToStaticMarkup(await EnquiriesTab({ showAll: true }))
    expect(html).toContain('name="enquiryId" value="lead-1"')
  })
})
