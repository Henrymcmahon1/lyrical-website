import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Chunk F + voice training: an entitled submit auto-queues, and if it picked a
 * trained ('ready') voice the job carries that voice so the pipeline renders the
 * full cascade; otherwise it stays null and the pipeline restores zero-shot.
 */

const currentUser = vi.fn()
const serverFrom = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  currentUser: () => currentUser(),
  supabaseServer: async () => ({ from: (...a: unknown[]) => serverFrom(...a) }),
}))

const adminUpdate = vi.fn()
const adminEq = vi.fn()
const adminVoice = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: () => ({
      update: (payload: unknown) => {
        adminUpdate(payload)
        return { eq: (...a: unknown[]) => adminEq(...a) }
      },
      select: () => ({ eq: () => ({ maybeSingle: () => adminVoice() }) }),
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

let JOB: Record<string, unknown>
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

function baseJob(over: Record<string, unknown> = {}) {
  return {
    title: 'T',
    primaryArtist: 'A',
    sourceLanguage: 'Spanish',
    targetLanguage: 'English',
    voicePreference: 'let_us_decide',
    assets: [{ kind: 'vocal', path: 'u1/j/v.flac', filename: 'v.flac', bytes: 10 }],
    ...over,
  }
}

async function run() {
  try {
    await submitSongJob({ jobId: JOB_ID, turnstileToken: 't' })
  } catch (e) {
    if (!(e instanceof Redirected)) throw e
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  currentUser.mockResolvedValue({ id: 'u1', email: 'a@b.co' })
  adminEq.mockResolvedValue({ error: null })
  adminVoice.mockResolvedValue({ data: null })
  serverFrom.mockImplementation(() => ({
    insert: async () => ({ error: null }),
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'voice-1' } }) }) }),
  }))
  JOB = baseJob()
})

describe('auto-queue on an entitled submit', () => {
  it('flips the job to queued, past human-accept, no trained voice -> zero-shot', async () => {
    await run()
    expect(adminUpdate).toHaveBeenCalledTimes(1)
    const payload = adminUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.pipeline_state).toBe('queued')
    expect(payload.status).toBe('approved')
    expect(payload.route).toBe('auto')
    expect(payload.quota_consumed_at).toBeTruthy()
    expect('pipeline_voice_model' in payload).toBe(false)
    expect(adminEq).toHaveBeenCalledWith('id', JOB_ID)
  })

  it('carries the trained voice when the chosen voice is ready', async () => {
    JOB = baseJob({ voiceId: 'voice-1', voicePreference: undefined })
    adminVoice.mockResolvedValue({ data: { status: 'ready', pipeline_voice_model: 'artist_v1' } })
    await run()
    const payload = adminUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.pipeline_voice_model).toBe('artist_v1')
  })
})
