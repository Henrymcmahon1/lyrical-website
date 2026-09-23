import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `app/api/hooks/rating-reminder/route.ts`: the Vercel Cron target. `lib/rating-reminder-hook.ts`
 * is unit tested on its own against injected deps; these tests exercise the wiring: the
 * Authorization gate and that a real `song_jobs` / `job_feedback` / `profiles` shape produces the
 * right due-job set.
 */

const alreadySentForJob = vi.fn()
const logSend = vi.fn()
const productEmailAllowedToday = vi.fn()
vi.mock('@/lib/email-log', async () => {
  const actual = await vi.importActual<typeof import('@/lib/email-log')>('@/lib/email-log')
  return {
    ...actual,
    alreadySentForJob: (...a: unknown[]) => alreadySentForJob(...a),
    logSend: (...a: unknown[]) => logSend(...a),
    productEmailAllowedToday: (...a: unknown[]) => productEmailAllowedToday(...a),
  }
})

const mailCustomer = vi.fn()
vi.mock('@/lib/mailer', () => ({ mailCustomer: (...a: unknown[]) => mailCustomer(...a) }))

const getUserById = vi.fn()

// song_jobs: due jobs. job_feedback: which of them are already rated. profiles: prefs.
const songJobsGte = vi.fn()
const songJobsNeq = vi.fn()
const songJobsLt = vi.fn()
let dueRows: { id: string; user_id: string; title: string }[] = []
let feedbackRows: { job_id: string }[] = []
let profileRow: { product_emails: boolean; rating_reminders: boolean } | null = null

const from = vi.fn((table: string) => {
  if (table === 'song_jobs') {
    return {
      select: () => ({
        eq: () => ({
          neq: (...n: unknown[]) => {
            songJobsNeq(...n)
            return { gte: (...a: unknown[]) => {
            songJobsGte(...a)
            return {
              lt: (...b: unknown[]) => {
                songJobsLt(...b)
                return Promise.resolve({ data: dueRows, error: null })
              },
            }
          } }
          },
        }),
      }),
    }
  }
  if (table === 'job_feedback') {
    return { select: () => ({ in: () => Promise.resolve({ data: feedbackRows, error: null }) }) }
  }
  if (table === 'profiles') {
    return {
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: profileRow, error: null }) }),
      }),
    }
  }
  throw new Error(`unexpected table ${table}`)
})

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ auth: { admin: { getUserById: (...a: unknown[]) => getUserById(...a) } }, from }),
}))

const { GET } = await import('@/app/api/hooks/rating-reminder/route')

function req(secret?: string) {
  return new Request('http://localhost/api/hooks/rating-reminder', {
    method: 'GET',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'shh'
  dueRows = [{ id: 'job-a', user_id: 'user-1', title: 'Midnight City' }]
  feedbackRows = []
  profileRow = { product_emails: true, rating_reminders: true }
  alreadySentForJob.mockResolvedValue(false)
  productEmailAllowedToday.mockResolvedValue(true)
  logSend.mockResolvedValue(undefined)
  mailCustomer.mockResolvedValue(true)
  getUserById.mockResolvedValue({ data: { user: { email: 'artist@label.example' } }, error: null })
})

describe('the secret gate', () => {
  it('401s a missing or wrong bearer token when one is configured', async () => {
    expect((await GET(req())).status).toBe(401)
    expect((await GET(req('wrong'))).status).toBe(401)
    expect(mailCustomer).not.toHaveBeenCalled()
  })

  it('503s when CRON_SECRET is unset in production', async () => {
    delete process.env.CRON_SECRET
    vi.stubEnv('NODE_ENV', 'production')
    expect((await GET(req('anything'))).status).toBe(503)
    vi.unstubAllEnvs()
  })
})

describe('a due, unrated, opted-in delivery', () => {
  it('200s and mails the owner', async () => {
    const res = await GET(req('shh'))
    expect(res.status).toBe(200)
    expect(mailCustomer).toHaveBeenCalledOnce()
    const [mail, label] = mailCustomer.mock.calls[0]
    expect(mail.to).toBe('artist@label.example')
    expect(label).toBe('rating-reminder')
    expect(logSend).toHaveBeenCalledOnce()
    // Door 1 is excluded in the query itself.
    expect(songJobsNeq).toHaveBeenCalledWith('delivery_profile', 'door1')
  })
})

describe('already rated', () => {
  it('200s without mailing when job_feedback has a row for that job', async () => {
    feedbackRows = [{ job_id: 'job-a' }]
    const res = await GET(req('shh'))
    expect(res.status).toBe(200)
    expect(mailCustomer).not.toHaveBeenCalled()
  })
})

describe('opted out', () => {
  it('200s without mailing when product_emails is false', async () => {
    profileRow = { product_emails: false, rating_reminders: true }
    const res = await GET(req('shh'))
    expect(res.status).toBe(200)
    expect(mailCustomer).not.toHaveBeenCalled()
  })
})

describe('nothing due', () => {
  it('200s cleanly with an empty result', async () => {
    dueRows = []
    const res = await GET(req('shh'))
    expect(res.status).toBe(200)
    expect(mailCustomer).not.toHaveBeenCalled()
  })
})

describe('resilience', () => {
  it('200s even when the handler throws internally', async () => {
    getUserById.mockRejectedValue(new Error('supabase is down'))
    const res = await GET(req('shh'))
    expect(res.status).toBe(200)
  })
})
