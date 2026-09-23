import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_OK, BREAK_GLASS_OK } from './admin-gate-fixtures'

/**
 * The Door 1 server actions: the upload ticket and the job insert.
 *
 * What matters most: the row written is exactly the README contract (route and profile door1,
 * no quota stamp), a break-glass session is refused because a job needs a real `user_id`, the
 * uploaded path must sit under the admin's own folder for THIS job, and a failed asset insert
 * rolls the job back.
 */

const inserts: Array<{ table: string; row: unknown }> = []
const deletes: Array<{ table: string; id: unknown }> = []
const removed: unknown[] = []
let jobInsertError: unknown = null
let assetInsertError: unknown = null
const createSignedUploadUrl = vi.fn()

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => ({
      insert: async (row: unknown) => {
        inserts.push({ table, row })
        if (table === 'song_jobs') return { error: jobInsertError }
        if (table === 'song_job_assets') return { error: assetInsertError }
        return { error: null }
      },
      delete: () => ({
        eq: async (_c: string, id: unknown) => {
          deletes.push({ table, id })
          return { error: null }
        },
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        createSignedUploadUrl: (...a: unknown[]) => createSignedUploadUrl(bucket, ...a),
        remove: async (paths: unknown) => {
          removed.push({ bucket, paths })
          return { error: null }
        },
      }),
    },
  }),
}))

const requireAdmin = vi.fn()
vi.mock('@/lib/admin-session', () => ({ requireAdmin: () => requireAdmin() }))

class RedirectError extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`)
  }
}
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectError(to)
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { createDoor1Job, door1UploadTicket } = await import('@/app/admin/door1/actions')

const ADMIN_ID = (ADMIN_OK as { user: { id: string } }).user.id
const JOB_ID = '22222222-2222-4222-8222-222222222222'
const QOBUZ = 'https://open.qobuz.com/track/123'

const BASE = {
  jobId: JOB_ID,
  primaryArtist: 'Coffey Anderson',
  title: 'Sweet Home',
  sourceLanguage: 'EN',
  targetLanguage: 'ES',
  sourceUrl: QOBUZ,
}

beforeEach(() => {
  vi.clearAllMocks()
  inserts.length = 0
  deletes.length = 0
  removed.length = 0
  jobInsertError = null
  assetInsertError = null
  requireAdmin.mockResolvedValue(ADMIN_OK)
  createSignedUploadUrl.mockResolvedValue({ data: { token: 'tok', path: 'p', signedUrl: 'https://s' }, error: null })
})

describe('createDoor1Job', () => {
  it('inserts the contract row for a Qobuz job and no asset', async () => {
    const r = await createDoor1Job({ ...BASE, voiceModel: 'Coffey_Anderson' })
    expect(r).toEqual({ ok: true, jobId: JOB_ID })
    expect(inserts).toHaveLength(1)
    const row = inserts[0].row as Record<string, unknown>
    expect(inserts[0].table).toBe('song_jobs')
    expect(row).toMatchObject({
      id: JOB_ID,
      user_id: ADMIN_ID,
      route: 'door1',
      delivery_profile: 'door1',
      status: 'approved',
      pipeline_state: 'queued',
      quota_consumed_at: null,
      pipeline_voice_model: 'Coffey_Anderson',
      door1_source_url: QOBUZ,
      door1_settings: { vocal_denoise: true, restore_mode: 'cascade' },
      rights_terms_version: null,
      licence_terms_version: null,
    })
    expect(typeof row.approved_at).toBe('string')
  })

  it('inserts one full_mix asset for an uploaded source', async () => {
    const asset = { path: `${ADMIN_ID}/${JOB_ID}/full_mix-1.flac`, filename: 'mix.flac', bytes: 1000 }
    const r = await createDoor1Job({ ...BASE, sourceUrl: '', asset })
    expect(r).toEqual({ ok: true, jobId: JOB_ID })
    expect(inserts.map((i) => i.table)).toEqual(['song_jobs', 'song_job_assets'])
    expect(inserts[1].row).toEqual({ job_id: JOB_ID, user_id: ADMIN_ID, kind: 'full_mix', ...asset })
  })

  it('rolls the job back (and removes the upload) when the asset insert fails', async () => {
    assetInsertError = { message: 'boom' }
    const asset = { path: `${ADMIN_ID}/${JOB_ID}/full_mix-1.flac`, filename: 'mix.flac', bytes: 1000 }
    const r = await createDoor1Job({ ...BASE, sourceUrl: '', asset })
    expect(r.ok).toBe(false)
    expect(deletes).toEqual([{ table: 'song_jobs', id: JOB_ID }])
    expect(removed).toEqual([{ bucket: 'submissions', paths: [asset.path] }])
  })

  it('reports a failed job insert and writes no asset', async () => {
    jobInsertError = { message: 'nope' }
    const asset = { path: `${ADMIN_ID}/${JOB_ID}/full_mix-1.flac`, filename: 'mix.flac', bytes: 1000 }
    const r = await createDoor1Job({ ...BASE, sourceUrl: '', asset })
    expect(r.ok).toBe(false)
    expect(inserts.map((i) => i.table)).toEqual(['song_jobs'])
    expect(removed).toEqual([{ bucket: 'submissions', paths: [asset.path] }])
  })

  it('refuses an uploaded path outside the admin folder for this job', async () => {
    for (const path of [
      `someone-else/${JOB_ID}/full_mix-1.flac`,
      `${ADMIN_ID}/33333333-3333-4333-8333-333333333333/full_mix-1.flac`,
      `${ADMIN_ID}/${JOB_ID}/../x.flac`,
    ]) {
      const r = await createDoor1Job({ ...BASE, sourceUrl: '', asset: { path, filename: 'a.flac', bytes: 5 } })
      expect(r.ok).toBe(false)
    }
    expect(inserts).toHaveLength(0)
  })

  it('refuses invalid input with the schema message and writes nothing', async () => {
    const r = await createDoor1Job({ ...BASE, targetLanguage: 'JA' })
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/Japanese/) })
    expect(inserts).toHaveLength(0)
  })

  it('refuses a break-glass session: a job needs a real user_id', async () => {
    requireAdmin.mockResolvedValue(BREAK_GLASS_OK)
    const r = await createDoor1Job(BASE)
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/signed in/i) })
    expect(inserts).toHaveLength(0)
  })
})

describe('door1UploadTicket', () => {
  it('mints a signed upload URL under {admin}/{job}/ in the submissions bucket', async () => {
    const r = await door1UploadTicket({ filename: 'Sweet Home.WAV', bytes: 1234 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.jobId).toMatch(/^[0-9a-f-]{36}$/)
    expect(r.path).toBe(`${ADMIN_ID}/${r.jobId}/full_mix-1.wav`)
    expect(r.token).toBe('tok')
    expect(createSignedUploadUrl).toHaveBeenCalledWith('submissions', r.path)
  })

  it('refuses over 50 MB with the way out, before signing anything', async () => {
    const r = await door1UploadTicket({ filename: 'a.wav', bytes: 50 * 1024 * 1024 + 1 })
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/use FLAC or a Qobuz link/) })
    expect(createSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('refuses a wrong file type', async () => {
    const r = await door1UploadTicket({ filename: 'a.ogg', bytes: 10 })
    expect(r.ok).toBe(false)
    expect(createSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('refuses a break-glass session', async () => {
    requireAdmin.mockResolvedValue(BREAK_GLASS_OK)
    const r = await door1UploadTicket({ filename: 'a.wav', bytes: 10 })
    expect(r.ok).toBe(false)
    expect(createSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('fails loud when storage will not sign', async () => {
    createSignedUploadUrl.mockResolvedValue({ data: null, error: { message: 'x' } })
    const r = await door1UploadTicket({ filename: 'a.wav', bytes: 10 })
    expect(r.ok).toBe(false)
  })
})
