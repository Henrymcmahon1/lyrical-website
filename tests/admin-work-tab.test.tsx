import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * The Work tab's automated-pipeline additions: `pipeline_error` (staff-only, shown here),
 * re-roll families nested under their original, deliveries with `watermark_id`, and the
 * re-queue button offered only on a rejected job.
 */

const listUsers = vi.fn()
const from = vi.fn()

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: (...a: unknown[]) => from(...a),
    auth: { admin: { listUsers: (...a: unknown[]) => listUsers(...a) } },
  }),
}))

vi.mock('@/app/admin/actions', () => ({
  moveJob: vi.fn(),
  saveNote: vi.fn(),
  requeueJob: vi.fn(),
}))

const { SongsTab } = await import('@/app/admin/SongsTab')

const PARENT = {
  id: 'job-parent',
  created_at: '2026-09-20T08:00:00.000Z',
  user_id: 'user-1',
  title: 'A Song',
  primary_artist: 'An Artist',
  source_language: 'EN',
  target_language: 'ES',
  notes: null,
  status: 'delivered',
  approved_at: '2026-09-20T08:30:00.000Z',
  delivered_at: '2026-09-20T09:00:00.000Z',
  internal_notes: null,
  lyrics: 'la la la',
  voice_id: null,
  voice_preference: null,
  pipeline_state: 'delivered',
  pipeline_error: null,
  parent_job_id: null,
  reroll_index: 0,
}

const CHILD = {
  ...PARENT,
  id: 'job-child',
  status: 'delivered',
  parent_job_id: 'job-parent',
  reroll_index: 1,
  lyrics: null,
}

const FAILED = {
  ...PARENT,
  id: 'job-failed',
  title: 'A Failed Song',
  status: 'rejected',
  pipeline_state: 'failed',
  pipeline_error: 'watermark model missing',
}

function withJobs(jobs: unknown[], deliveries: unknown[] = []) {
  from.mockImplementation((table: string) => {
    if (table === 'song_jobs') {
      const chain = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        in: () => chain,
        then: (resolve: (v: unknown) => void) => resolve({ data: jobs, error: null, count: jobs.length }),
      }
      return chain
    }
    if (table === 'song_job_deliveries') {
      return { select: () => ({ in: () => Promise.resolve({ data: deliveries, error: null }) }) }
    }
    // song_job_assets and voice_models
    return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }
  })
  listUsers.mockResolvedValue({ data: { users: [{ id: 'user-1', email: 'artist@label.example' }] } })
}

async function render(props: { showAll?: boolean; confirming?: string } = {}) {
  const element = await SongsTab({ showAll: false, ...props })
  return renderToStaticMarkup(element)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('pipeline_error', () => {
  it('shows the pipeline error on a failed job (staff-only field, shown here)', async () => {
    withJobs([FAILED])
    const html = await render({ showAll: true })
    expect(html).toContain('watermark model missing')
  })

  it('shows no pipeline error line when there is none', async () => {
    withJobs([PARENT])
    const html = await render({ showAll: true })
    expect(html).not.toContain('Pipeline error')
  })
})

describe('re-roll families', () => {
  it('nests a child under its parent as Take 2', async () => {
    withJobs([PARENT, CHILD])
    const html = await render({ showAll: true })
    const parentIndex = html.indexOf('job-parent')
    // The parent job's own markup does not carry its id in text, so assert ordering by title
    // occurrence: the child's "Take 2" label must appear, and after the parent's row starts.
    expect(html).toContain('Take 2: A Song')
    const takeIndex = html.indexOf('Take 2: A Song')
    const titleIndex = html.indexOf('>A Song<')
    expect(takeIndex).toBeGreaterThan(titleIndex)
  })

  it('does not repeat the no-lyrics warning on a child with no lyrics of its own', async () => {
    withJobs([PARENT, CHILD])
    const html = await render({ showAll: true })
    // The parent has lyrics, so the warning should not appear at all here.
    expect(html).not.toContain('No lyrics. Ask for them before accepting')
  })
})

describe('deliveries', () => {
  it('shows the delivery kind, filename and watermark id', async () => {
    withJobs(
      [PARENT],
      [{ id: 'd1', job_id: 'job-parent', kind: 'full_mix', watermark_id: 2266, filename: 'a-song.mp3', bytes: 4_000_000 }],
    )
    const html = await render({ showAll: true })
    expect(html).toContain('a-song.mp3')
    expect(html).toContain('watermark 2266')
  })
})

describe('re-queue', () => {
  it('offers Re-queue on a rejected job', async () => {
    withJobs([FAILED])
    const html = await render({ showAll: true })
    expect(html).toContain('Re-queue')
  })

  it('does NOT offer Re-queue on a delivered job', async () => {
    withJobs([PARENT])
    const html = await render({ showAll: true })
    expect(html).not.toContain('Re-queue')
  })

  it('does NOT offer Re-queue on a submitted job (only Accept/Reject)', async () => {
    withJobs([{ ...PARENT, status: 'submitted', approved_at: null, delivered_at: null, pipeline_state: null }])
    const html = await render({ showAll: true })
    expect(html).not.toContain('Re-queue')
  })

  it('asks for confirmation before re-queuing', async () => {
    withJobs([FAILED])
    const html = await render({ showAll: true, confirming: 'job-failed' })
    expect(html).toContain('Yes, re-queue it')
  })
})

describe('Door 1 rows', () => {
  const DOOR1_ROW = {
    ...PARENT,
    id: 'job-door1',
    title: 'Door One Song',
    status: 'approved',
    pipeline_state: 'queued',
    lyrics: null,
    delivery_profile: 'door1',
  }

  it('reads delivery_profile so the tab can tell', async () => {
    const selects: unknown[] = []
    withJobs([DOOR1_ROW])
    const original = from.getMockImplementation()!
    from.mockImplementation((table: string) => {
      const q = original(table)
      if (table === 'song_jobs') {
        const sel = q.select
        q.select = (...a: unknown[]) => {
          selects.push(a[0])
          return sel(...a)
        }
      }
      return q
    })
    await render({ showAll: true })
    expect(String(selects[0])).toContain('delivery_profile')
  })

  it('labels a Door 1 row "Door 1", links to its console, and draws no move buttons', async () => {
    withJobs([DOOR1_ROW])
    const html = await render({ showAll: true })
    expect(html).toContain('>Door 1<')
    expect(html).toContain('href="/admin/door1/job-door1"')
    expect(html).toContain('Manage in Door 1')
    expect(html).not.toContain('name="to"')
    expect(html).not.toContain('No lyrics')
    expect(html).not.toContain('No files attached')
    expect(html).not.toContain('Time left')
  })

  it('a Door 2 row carries no Door 1 label (control)', async () => {
    withJobs([PARENT])
    expect(await render({ showAll: true })).not.toContain('>Door 1<')
  })
})
