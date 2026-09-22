import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `app/api/hooks/song-job/route.ts`: the Supabase Database Webhook target. Wires
 * `lib/song-job-hook.ts` (already unit tested against injected deps) to a real Supabase admin
 * client and `mailCustomer`. These tests exercise the wiring: the secret gate, the JSON body,
 * and that a real `song_jobs`/`auth.users` lookup shape produces a send.
 */

const alreadySentForJob = vi.fn()
const logSend = vi.fn()
vi.mock('@/lib/email-log', async () => {
  const actual = await vi.importActual<typeof import('@/lib/email-log')>('@/lib/email-log')
  return { ...actual, alreadySentForJob: (...a: unknown[]) => alreadySentForJob(...a), logSend: (...a: unknown[]) => logSend(...a) }
})

const mailCustomer = vi.fn()
vi.mock('@/lib/mailer', () => ({ mailCustomer: (...a: unknown[]) => mailCustomer(...a) }))

const getUserById = vi.fn()
const selectEq = vi.fn()
const from = vi.fn((table: string) => {
  if (table === 'song_jobs') {
    return {
      select: () => ({
        eq: (...args: unknown[]) => {
          selectEq(...args)
          return Promise.resolve({ count: 1, error: null })
        },
      }),
    }
  }
  throw new Error(`unexpected table ${table}`)
})
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ auth: { admin: { getUserById: (...a: unknown[]) => getUserById(...a) } }, from }),
}))

const { POST } = await import('@/app/api/hooks/song-job/route')

const record = {
  id: 'job-1',
  user_id: 'user-1',
  title: 'Midnight City',
  target_language: 'ES',
  status: 'delivered',
  parent_job_id: null,
  reroll_index: 0,
}
const oldRecord = { ...record, status: 'in_progress' }

function req(body: unknown, secret?: string) {
  return new Request('http://localhost/api/hooks/song-job', {
    method: 'POST',
    headers: secret ? { 'x-hook-secret': secret } : {},
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SONG_JOB_HOOK_SECRET = 'shh'
  alreadySentForJob.mockResolvedValue(false)
  logSend.mockResolvedValue(undefined)
  mailCustomer.mockResolvedValue(true)
  getUserById.mockResolvedValue({ data: { user: { email: 'artist@label.example' } }, error: null })
})

describe('the secret gate', () => {
  it('401s a missing or wrong secret when one is configured', async () => {
    expect((await POST(req({ type: 'UPDATE', record, old_record: oldRecord }))).status).toBe(401)
    expect(
      (await POST(req({ type: 'UPDATE', record, old_record: oldRecord }, 'wrong'))).status,
    ).toBe(401)
    expect(mailCustomer).not.toHaveBeenCalled()
  })

  it('503s when SONG_JOB_HOOK_SECRET is unset in production, fail loud', async () => {
    delete process.env.SONG_JOB_HOOK_SECRET
    vi.stubEnv('NODE_ENV', 'production')
    const res = await POST(req({ type: 'UPDATE', record, old_record: oldRecord }, 'anything'))
    expect(res.status).toBe(503)
    vi.unstubAllEnvs()
  })

  it('accepts a request with no secret header outside production when none is configured, for local testing', async () => {
    delete process.env.SONG_JOB_HOOK_SECRET
    const res = await POST(req({ type: 'UPDATE', record, old_record: oldRecord }))
    expect(res.status).toBe(200)
  })
})

describe('a recognised transition', () => {
  it('200s, mails the owner, and logs the send', async () => {
    const res = await POST(req({ type: 'UPDATE', record, old_record: oldRecord }, 'shh'))
    expect(res.status).toBe(200)
    expect(getUserById).toHaveBeenCalledWith('user-1')
    expect(mailCustomer).toHaveBeenCalledOnce()
    const [mail, label] = mailCustomer.mock.calls[0]
    expect(mail.to).toBe('artist@label.example')
    expect(label).toBe('track-delivered')
    expect(logSend).toHaveBeenCalledOnce()
  })
})

describe('a no-op transition', () => {
  it('200s without mailing anyone', async () => {
    const stillInProgress = { ...record, status: 'in_progress' }
    const res = await POST(req({ type: 'UPDATE', record: stillInProgress, old_record: oldRecord }, 'shh'))
    expect(res.status).toBe(200)
    expect(mailCustomer).not.toHaveBeenCalled()
  })
})

describe('idempotency', () => {
  it('200s and does not mail again for a job+slug already logged', async () => {
    alreadySentForJob.mockResolvedValue(true)
    const res = await POST(req({ type: 'UPDATE', record, old_record: oldRecord }, 'shh'))
    expect(res.status).toBe(200)
    expect(mailCustomer).not.toHaveBeenCalled()
  })
})

describe('an unknown user', () => {
  it('200s without mailing when auth.users has no email for that id', async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(req({ type: 'UPDATE', record, old_record: oldRecord }, 'shh'))
    expect(res.status).toBe(200)
    expect(mailCustomer).not.toHaveBeenCalled()
  })
})

describe('resilience', () => {
  it('200s even on a malformed body, rather than making Supabase retry forever', async () => {
    const res = await POST(
      new Request('http://localhost/api/hooks/song-job', {
        method: 'POST',
        headers: { 'x-hook-secret': 'shh' },
        body: 'not json',
      }),
    )
    expect(res.status).toBe(200)
    expect(mailCustomer).not.toHaveBeenCalled()
  })

  it('200s even when the handler throws internally', async () => {
    getUserById.mockRejectedValue(new Error('supabase is down'))
    const res = await POST(req({ type: 'UPDATE', record, old_record: oldRecord }, 'shh'))
    expect(res.status).toBe(200)
  })
})
