import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Chunk F: an entitled submit auto-queues itself. This pins the service-role
 * write that flips the job to pipeline_state='queued' (what the pipeline poller
 * claims) and past the human-accept status, alongside E's quota stamp.
 */

const currentUser = vi.fn()
const serverFrom = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  currentUser: () => currentUser(),
  supabaseServer: async () => ({ from: (...a: unknown[]) => serverFrom(...a) }),
}))

const adminUpdate = vi.fn()
const adminEq = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: () => ({
      update: (payload: unknown) => {
        adminUpdate(payload)
        return { eq: (...a: unknown[]) => adminEq(...a) }
      },
    }),
  }),
}))

vi.mock('@/lib/submit-gate', () => ({ assertEntitled: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/turnstile', () => ({ verifyTurnstile: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/song-upload', () => ({ pathBelongsTo: () => true }))
vi.mock('@/lib/mailer', () => ({ mailCustomer: vi.fn(), mailFounders: vi.fn() }))
vi.mock('@/lib/terms', () => ({ RIGHTS_TERMS_VERSION: 'v1' }))
vi.mock('@/lib/song-job-email', () => ({
  jobConfirmationHtml: () => '',
  jobConfirmationSubject: () => '',
  jobConfirmationText: () => '',
  jobNotificationHtml: () => '',
  jobNotificationSubject: () => '',
  jobNotificationText: () => '',
}))

const JOB = {
  title: 'T',
  primaryArtist: 'A',
  sourceLanguage: 'Spanish',
  targetLanguage: 'English',
  voicePreference: 'let_us_decide',
  assets: [{ kind: 'vocal', path: 'u1/j/v.flac', filename: 'v.flac', bytes: 10 }],
}
vi.mock('@/lib/song-job-schema', () => ({
  SongJobSchema: { safeParse: () => ({ success: true, data: JOB }) },
}))

class Redirected extends Error {}
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Redirected()
  },
}))
vi.mock('next/headers', () => ({ headers: async () => ({ get: () => '' }) }))

const { submitSongJob } = await import('@/app/studio/submit-actions')

const JOB_ID = '00000000-0000-0000-0000-000000000001'

beforeEach(() => {
  currentUser.mockReset()
  serverFrom.mockReset()
  adminUpdate.mockReset()
  adminEq.mockReset()
  currentUser.mockResolvedValue({ id: 'u1', email: 'a@b.co' })
  adminEq.mockResolvedValue({ error: null })
  // Every server-side .from(...) returns insert/select stubs that succeed.
  serverFrom.mockImplementation(() => ({
    insert: async () => ({ error: null }),
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
  }))
})

describe('auto-queue on an entitled submit', () => {
  it('flips the job to pipeline_state=queued and past human-accept', async () => {
    try {
      await submitSongJob({ jobId: JOB_ID, turnstileToken: 't' })
    } catch (e) {
      if (!(e instanceof Redirected)) throw e
    }
    expect(adminUpdate).toHaveBeenCalledTimes(1)
    const payload = adminUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.pipeline_state).toBe('queued')
    expect(payload.status).toBe('approved')
    expect(payload.quota_consumed_at).toBeTruthy()
    expect(payload.approved_at).toBeTruthy()
    expect(adminEq).toHaveBeenCalledWith('id', JOB_ID)
  })
})
