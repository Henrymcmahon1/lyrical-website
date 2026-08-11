import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * The Songs tab, actually rendered.
 *
 * The unit tests around it prove the rules; this proves the page built from those rules comes
 * out right. Two things are worth a render test rather than an eyeball:
 *
 *   The console must offer exactly the moves the lifecycle allows, per row, per status. A
 *   button that should not be there is a move somebody will make.
 *
 *   NO STORAGE PATH MAY REACH THE MARKUP. The whole argument for `/queue/audio` is that the
 *   page holds asset ids and never signed URLs, so that a cached page, a screenshot or a
 *   back-button does not hand over somebody's unreleased master. That claim is only worth
 *   anything if something checks it, and this is the something.
 *
 * There is no DOM here. The component is an async function that returns an element tree, so it
 * is awaited and rendered to a string. That is enough for both questions and avoids dragging a
 * browser environment into a test suite that runs in 600ms.
 */

const listUsers = vi.fn()
const from = vi.fn()

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: (...a: unknown[]) => from(...a),
    auth: { admin: { listUsers: (...a: unknown[]) => listUsers(...a) } },
  }),
}))

vi.mock('@/app/queue/actions', () => ({
  moveJob: vi.fn(),
  saveNote: vi.fn(),
}))

const { SongsTab } = await import('@/app/queue/SongsTab')

const JOB = {
  id: 'job-1',
  created_at: '2026-08-11T08:00:00.000Z',
  user_id: 'user-1',
  title: 'A Song',
  primary_artist: 'An Artist',
  source_language: 'EN',
  target_language: 'ES',
  notes: null,
  status: 'submitted',
  approved_at: null,
  delivered_at: null,
  internal_notes: null,
}

const ASSET = {
  id: 'asset-1',
  job_id: 'job-1',
  kind: 'full_mix',
  artist_name: null,
  filename: 'a-song-master.wav',
  bytes: 42_000_000,
}

/** Wires the mocked client for one set of rows. */
function withData(jobs: unknown[], assets: unknown[] = [ASSET]) {
  from.mockImplementation((table: string) => {
    if (table === 'song_jobs') {
      const chain = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        in: () => chain,
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: jobs, error: null, count: jobs.length }),
      }
      return chain
    }
    const assetChain = {
      select: () => assetChain,
      in: () => Promise.resolve({ data: assets, error: null }),
    }
    return assetChain
  })
  listUsers.mockResolvedValue({
    data: { users: [{ id: 'user-1', email: 'artist@label.example' }] },
  })
}

async function render(props: { showAll?: boolean; confirming?: string } = {}) {
  const element = await SongsTab({ showAll: false, ...props })
  return renderToStaticMarkup(element)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('what the console shows', () => {
  it('draws the job, who sent it, and the file', async () => {
    withData([JOB])
    const html = await render()
    expect(html).toContain('A Song')
    expect(html).toContain('An Artist')
    expect(html).toContain('artist@label.example')
    expect(html).toContain('a-song-master.wav')
    expect(html).toContain('English to Spanish')
    expect(html).toContain('40MB')
  })

  it('says out loud when a job arrived with no files', async () => {
    // Accepting an empty submission starts a delivery clock against nothing at all.
    withData([JOB], [])
    expect(await render()).toContain('Do not accept this one')
  })

  it('says nothing has arrived rather than rendering an empty list', async () => {
    withData([])
    expect(await render()).toContain('Nothing waiting')
  })
})

describe('the files are reachable but never handed over', () => {
  it('links through the signing route by asset id', async () => {
    withData([JOB])
    expect(await render()).toContain('/queue/audio?asset=asset-1')
  })

  it('NEVER puts a storage path, bucket or signed URL in the markup', async () => {
    /**
     * A signed URL carries its own authorization and asks nothing else, so one rendered into
     * this page keeps working for its whole life in the browser cache, in a screenshot, and in
     * whatever a misdirected share does with it. The page holds ids, which are worthless alone.
     */
    withData([JOB])
    const html = await render()
    expect(html).not.toMatch(/user-1\/job-1\//)
    expect(html).not.toMatch(/submissions\//)
    expect(html).not.toMatch(/supabase\.co/)
    expect(html).not.toMatch(/token=|X-Amz|createSignedUrl/i)
  })
})

describe('the moves offered per status', () => {
  it('offers accept and reject on something new, and nothing else', async () => {
    withData([JOB])
    const html = await render()
    expect(html).toContain('Accept')
    expect(html).toContain('Reject')
    expect(html).not.toContain('Mark delivered')
    expect(html).not.toContain('Start work')
  })

  it('offers no way to reject something already accepted', async () => {
    // Retracting a delivery promise that has been emailed is a conversation, not a button.
    withData([{ ...JOB, status: 'approved', approved_at: '2026-08-11T09:00:00.000Z' }])
    const html = await render()
    expect(html).toContain('Start work')
    expect(html).toContain('Mark delivered')
    expect(html).not.toContain('Reject')
  })

  it('offers nothing at all on a finished job', async () => {
    withData([{ ...JOB, status: 'delivered', delivered_at: '2026-08-11T09:00:00.000Z' }])
    const html = await render()
    expect(html).not.toContain('Accept')
    expect(html).not.toContain('Mark delivered')
    expect(html).not.toContain('Start work')
  })

  it('warns what accepting commits us to, next to the button that does it', async () => {
    withData([JOB])
    expect(await render()).toContain('48 hour clock')
  })

  it('spells out that rejecting is silent before it happens', async () => {
    // Confirm step, page state rather than a browser dialog, so it survives JavaScript off.
    withData([JOB])
    const html = await render({ confirming: 'job-1' })
    expect(html).toContain('sends no email at all')
    expect(html).toContain('Yes, reject it')
  })
})

describe('the delivery clock', () => {
  it('shows time remaining once a job has been accepted', async () => {
    withData([{ ...JOB, status: 'approved', approved_at: new Date().toISOString() }])
    expect(await render()).toMatch(/4[78]h left/)
  })

  it('shows no clock before acceptance, because none is running', async () => {
    withData([JOB])
    expect(await render()).not.toMatch(/h left|h over/)
  })
})
