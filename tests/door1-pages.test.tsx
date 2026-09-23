import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ADMIN_OK, BREAK_GLASS_OK, MFA_REQUIRED, NOT_ALLOWLISTED, NO_SESSION, REFUSALS } from './admin-gate-fixtures'

/**
 * The three Door 1 pages: the list, the create form and a job's detail. Each is gated by
 * `requireAdmin()` exactly like `/admin`, reads Door 1 rows only, and never writes a signed URL
 * or a storage path into its markup.
 */

const requireAdmin = vi.fn()
vi.mock('@/lib/admin-session', () => ({ requireAdmin: () => requireAdmin() }))

class RedirectError extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`)
  }
}
class NotFoundError extends Error {}
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectError(to)
  },
  notFound: () => {
    throw new NotFoundError('NOT_FOUND')
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/app/admin/actions', () => ({ requeueJob: vi.fn() }))
vi.mock('@/app/admin/door1/actions', () => ({ createDoor1Job: vi.fn(), door1UploadTicket: vi.fn() }))

/** Every call made on the admin client, as [table, method, ...args]. */
const calls: unknown[][] = []
let tables: Record<string, unknown> = {}
const touched = vi.fn()

function chainFor(table: string) {
  const result = () => {
    const v = tables[table]
    return { data: v ?? null, error: null }
  }
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'not', 'in', 'order', 'limit']) {
    chain[m] = (...a: unknown[]) => {
      calls.push([table, m, ...a])
      return chain
    }
  }
  chain.maybeSingle = async () => {
    const v = tables[table]
    return { data: Array.isArray(v) ? (v[0] ?? null) : (v ?? null), error: null }
  }
  chain.then = (resolve: (v: unknown) => void) => resolve(result())
  return chain
}

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => {
    touched()
    return { from: (t: string) => chainFor(t) }
  },
}))

const { default: ListPage } = await import('@/app/admin/door1/page')
const { default: NewPage } = await import('@/app/admin/door1/new/page')
const { default: DetailPage } = await import('@/app/admin/door1/[id]/page')

const JOB_ID = '22222222-2222-4222-8222-222222222222'
const ENQUIRY_ID = '33333333-3333-4333-8333-333333333333'

const JOB = {
  id: JOB_ID,
  created_at: '2026-09-24T01:00:00.000Z',
  title: 'Sweet Home',
  primary_artist: 'Coffey Anderson',
  source_language: 'EN',
  target_language: 'ES',
  lyrics: null,
  notes: 'rush it',
  status: 'delivered',
  approved_at: '2026-09-24T01:00:00.000Z',
  delivered_at: '2026-09-24T03:00:00.000Z',
  pipeline_state: 'delivered',
  pipeline_error: null,
  pipeline_voice_model: 'Coffey_Anderson',
  delivery_profile: 'door1',
  door1_enquiry_id: ENQUIRY_ID,
  door1_source_url: 'https://open.qobuz.com/track/1',
  door1_settings: { vocal_denoise: true, restore_mode: 'cascade' },
  door1_due_on: '2026-10-01',
}

const DELIVERIES = [
  { id: 'd-vocal-0000-0000-0000-000000000001', kind: 'vocal', filename: 'vocal.flac', bytes: 30_000_000, created_at: JOB.delivered_at, purged_at: null },
  { id: 'd-instr-0000-0000-0000-000000000002', kind: 'instrumental', filename: 'instrumental.flac', bytes: 30_000_000, created_at: JOB.delivered_at, purged_at: null },
  { id: 'd-mixxx-0000-0000-0000-000000000003', kind: 'mix', filename: 'mix.flac', bytes: 30_000_000, created_at: JOB.delivered_at, purged_at: '2026-10-01T00:00:00Z' },
]

const html = (el: unknown) => renderToStaticMarkup(el as React.ReactElement)
const list = async (p: Record<string, string> = {}) => html(await ListPage({ searchParams: Promise.resolve(p) }))
const detail = async (id = JOB_ID) =>
  html(await DetailPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }))
const create = async () => html(await NewPage())

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  tables = {}
  requireAdmin.mockResolvedValue(ADMIN_OK)
})
afterEach(() => {
  delete process.env.ADMIN_BREAK_GLASS
  delete process.env.ADMIN_PASSWORD
})

describe.each([
  ['list', () => list()],
  ['new', () => create()],
  ['detail', () => detail()],
])('the %s page gate', (_name, render) => {
  it('sends a signed-out visitor to /admin/sign-in, reading nothing', async () => {
    requireAdmin.mockResolvedValue(NO_SESSION)
    await expect(render()).rejects.toThrow('REDIRECT:/admin/sign-in')
    expect(touched).not.toHaveBeenCalled()
  })

  it('sends a signed-out visitor to /admin (the break-glass form) when break-glass is on', async () => {
    process.env.ADMIN_BREAK_GLASS = 'on'
    process.env.ADMIN_PASSWORD = 'x'
    requireAdmin.mockResolvedValue(NO_SESSION)
    await expect(render()).rejects.toThrow('REDIRECT:/admin')
    expect(touched).not.toHaveBeenCalled()
  })

  it('shows Not authorized to a signed-in customer, reading nothing', async () => {
    requireAdmin.mockResolvedValue(NOT_ALLOWLISTED)
    expect(await render()).toContain('Not authorized')
    expect(touched).not.toHaveBeenCalled()
  })

  it('shows the MFA notice short of AAL2, reading nothing', async () => {
    requireAdmin.mockResolvedValue(MFA_REQUIRED)
    expect(await render()).toContain('Two-step verification required')
    expect(touched).not.toHaveBeenCalled()
  })

  it('calls requireAdmin exactly once', async () => {
    tables = { song_jobs: [JOB], song_job_deliveries: DELIVERIES, song_job_assets: [], enquiries: [] }
    await render()
    expect(requireAdmin).toHaveBeenCalledTimes(1)
  })
})

it('REFUSALS fixture still covers the three refusals', () => {
  expect(REFUSALS).toHaveLength(3)
})

describe('list', () => {
  it('reads Door 1 rows only, newest first, never select *', async () => {
    tables = { song_jobs: [JOB] }
    await list()
    expect(calls).toContainEqual(['song_jobs', 'eq', 'delivery_profile', 'door1'])
    expect(calls).toContainEqual(['song_jobs', 'order', 'created_at', { ascending: false }])
    const select = calls.find((c) => c[0] === 'song_jobs' && c[1] === 'select')
    expect(select?.[2]).not.toContain('*')
  })

  it('shows artist, title, languages, voice, due date, state, created and delivered', async () => {
    tables = { song_jobs: [JOB] }
    const out = await list()
    for (const s of ['Sweet Home', 'Coffey Anderson', 'English to Spanish', 'voice: Coffey_Anderson', 'due 1 Oct 2026', 'Delivered', 'created', 'delivered']) {
      expect(out).toContain(s)
    }
  })

  it('shows pipeline_error and a re-queue button (back=door1) on a failed job', async () => {
    tables = { song_jobs: [{ ...JOB, status: 'rejected', pipeline_state: 'failed', pipeline_error: 'voice model Nope unknown' }] }
    const out = await list()
    expect(out).toContain('voice model Nope unknown')
    expect(out).toContain('Re-queue')
    expect(out).toContain('name="back" value="door1"')
  })

  it('offers no re-queue on a delivered job', async () => {
    tables = { song_jobs: [JOB] }
    expect(await list()).not.toContain('Re-queue')
  })

  it('is readable in a break-glass session', async () => {
    requireAdmin.mockResolvedValue(BREAK_GLASS_OK)
    tables = { song_jobs: [JOB] }
    expect(await list()).toContain('Sweet Home')
  })
})

describe('detail', () => {
  beforeEach(() => {
    tables = {
      song_jobs: [JOB],
      song_job_deliveries: DELIVERIES,
      song_job_assets: [],
      enquiries: [{ id: ENQUIRY_ID, name: 'Coffey Anderson', company: 'CA Music', rel_status: 'signed' }],
    }
  })

  it('lists the three stems as 24-bit FLAC (lossless), downloaded through the signing route', async () => {
    const out = await detail()
    expect(out).toContain('24-bit FLAC (lossless)')
    expect(out).toContain(`/admin/door1/download?delivery=${DELIVERIES[0].id}`)
    expect(out).toContain(`/admin/door1/download?delivery=${DELIVERIES[1].id}`)
  })

  it('shows Purged (masters on the OptiPlex) and no link for a purged stem', async () => {
    const out = await detail()
    expect(out).toContain('Purged')
    expect(out).toContain('OptiPlex')
    expect(out).not.toContain(`delivery=${DELIVERIES[2].id}`)
  })

  it('never writes a storage path or signed URL into the page', async () => {
    const out = await detail()
    expect(out).not.toContain(`${JOB_ID}/vocal.flac`)
    expect(out).not.toMatch(/token=|\/storage\/v1\//)
  })

  it('links back to the CRM enquiry', async () => {
    expect(await detail()).toContain(`#enquiry-${ENQUIRY_ID}`)
  })

  it('is a 404 for a Door 2 job id', async () => {
    tables.song_jobs = [{ ...JOB, delivery_profile: 'door2' }]
    await expect(detail()).rejects.toThrow('NOT_FOUND')
  })

  it('is a 404 for a malformed id, reading nothing', async () => {
    await expect(detail('../x')).rejects.toThrow('NOT_FOUND')
    expect(calls).toHaveLength(0)
  })

  it('is readable in a break-glass session', async () => {
    requireAdmin.mockResolvedValue(BREAK_GLASS_OK)
    expect(await detail()).toContain('Sweet Home')
  })
})

describe('new', () => {
  it('refuses a break-glass session with a reason and no form, reading nothing', async () => {
    requireAdmin.mockResolvedValue(BREAK_GLASS_OK)
    const out = await create()
    expect(out).toContain('break-glass')
    expect(out).not.toContain('<form')
    expect(touched).not.toHaveBeenCalled()
  })

  it('draws the form with signed artists first and past Door 1 voice names in the datalist', async () => {
    tables = {
      enquiries: [
        { id: 'e1', name: 'Lead Person', company: null, rel_status: 'new' },
        { id: 'e2', name: 'Coffey Anderson', company: null, rel_status: 'signed' },
      ],
      song_jobs: [{ pipeline_voice_model: 'Coffey_Anderson' }, { pipeline_voice_model: 'Coffey_Anderson' }],
    }
    const out = await create()
    expect(out).toContain('<form')
    expect(out.indexOf('Coffey Anderson (signed)')).toBeLessThan(out.indexOf('Lead Person (new)'))
    expect(out.match(/<option value="Coffey_Anderson">/g)).toHaveLength(1)
    expect(calls).toContainEqual(['song_jobs', 'eq', 'delivery_profile', 'door1'])
  })

  it('labels lyrics optional and reference only', async () => {
    tables = { enquiries: [], song_jobs: [] }
    const out = await create()
    expect(out).toContain('Lyrics (optional, reference only)')
    expect(out).toMatch(/does not use them today/)
  })

  it('flags Japanese as a target with no language pack', async () => {
    tables = { enquiries: [], song_jobs: [] }
    expect(await create()).toContain('Japanese (no language pack yet)')
  })
})
