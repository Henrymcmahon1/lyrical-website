import { describe, expect, it, vi, beforeEach } from 'vitest'
import { classifySlug, handleSongJobWebhook, type SongJobHookDeps, type SongJobRecord } from '@/lib/song-job-hook'

/**
 * The decision logic behind `app/api/hooks/song-job/route.ts`, tested without a database or a
 * real Supabase Database Webhook. `classifySlug` is the pure transition matrix; `handleSongJobWebhook`
 * wires it to injected deps the same way `lib/stripe-webhook.ts` wires `WebhookDeps`.
 */

const original: SongJobRecord = {
  id: 'job-original',
  user_id: 'user-1',
  title: 'Midnight City',
  target_language: 'ES',
  status: 'submitted',
  parent_job_id: null,
  reroll_index: 0,
}

const child: SongJobRecord = {
  ...original,
  id: 'job-child',
  parent_job_id: 'job-original',
  reroll_index: 1,
}

describe('classifySlug: the transition matrix', () => {
  it('an original job reaching delivered is track-delivered', () => {
    expect(classifySlug({ ...original, status: 'delivered' }, { ...original, status: 'in_progress' })).toBe(
      'track-delivered',
    )
  })

  it('a child job reaching delivered is reroll-delivered', () => {
    expect(classifySlug({ ...child, status: 'delivered' }, { ...child, status: 'in_progress' })).toBe(
      'reroll-delivered',
    )
  })

  it('any job reaching rejected is track-not-made, original or child', () => {
    expect(classifySlug({ ...original, status: 'rejected' }, { ...original, status: 'in_progress' })).toBe(
      'track-not-made',
    )
    expect(classifySlug({ ...child, status: 'rejected' }, { ...child, status: 'in_progress' })).toBe(
      'track-not-made',
    )
  })

  it('no status change at all is a no-op', () => {
    expect(classifySlug({ ...original, status: 'in_progress' }, { ...original, status: 'in_progress' })).toBe(
      null,
    )
  })

  it('a move to any other status is a no-op (submitted, approved, in_progress)', () => {
    for (const status of ['approved', 'in_progress']) {
      expect(classifySlug({ ...original, status }, { ...original, status: 'submitted' })).toBe(null)
    }
  })

  it('an already-delivered row updated again (e.g. a purge stamp) is a no-op', () => {
    expect(classifySlug({ ...original, status: 'delivered' }, { ...original, status: 'delivered' })).toBe(
      null,
    )
  })

  it('classifies from status alone when old_record is missing or partial', () => {
    // Supabase only guarantees a full old_record when the table has REPLICA IDENTITY FULL
    // (noted for Henry in the PR body). Without one, there is no proof this was NOT a
    // transition, so this stays permissive and leans on `alreadySentForJob`'s job-scoped
    // idempotency in `handleSongJobWebhook` to make a repeat call a no-op instead.
    expect(classifySlug({ ...original, status: 'delivered' }, null)).toBe('track-delivered')
    expect(classifySlug({ ...original, status: 'delivered' }, undefined)).toBe('track-delivered')
  })
})

function makeDeps(overrides: Partial<SongJobHookDeps> = {}): SongJobHookDeps {
  return {
    alreadySentForJob: vi.fn().mockResolvedValue(false),
    lookupEmail: vi.fn().mockResolvedValue('artist@label.example'),
    childCount: vi.fn().mockResolvedValue(1),
    sendMail: vi.fn().mockResolvedValue(true),
    logSend: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('handleSongJobWebhook', () => {
  it('ignores anything that is not an UPDATE', async () => {
    const deps = makeDeps()
    const result = await handleSongJobWebhook(
      { type: 'INSERT', record: original, old_record: null },
      deps,
    )
    expect(result).toEqual({ sent: false, slug: null })
    expect(deps.sendMail).not.toHaveBeenCalled()
  })

  it('sends track-delivered for an original job, looks up the email, logs the send', async () => {
    const deps = makeDeps()
    const result = await handleSongJobWebhook(
      { type: 'UPDATE', record: { ...original, status: 'delivered' }, old_record: { ...original, status: 'in_progress' } },
      deps,
    )
    expect(result).toEqual({ sent: true, slug: 'track-delivered' })
    expect(deps.lookupEmail).toHaveBeenCalledWith('user-1')
    expect(deps.sendMail).toHaveBeenCalledOnce()
    const [mail, label] = (deps.sendMail as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(mail.to).toBe('artist@label.example')
    expect(mail.subject).toContain('Midnight City')
    expect(label).toBe('track-delivered')
    expect(deps.logSend).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', slug: 'track-delivered', jobId: 'job-original' }),
    )
  })

  it('sends reroll-delivered for a child job, naming the take and re-rolls remaining', async () => {
    const deps = makeDeps({ childCount: vi.fn().mockResolvedValue(1) })
    const result = await handleSongJobWebhook(
      { type: 'UPDATE', record: { ...child, status: 'delivered' }, old_record: { ...child, status: 'in_progress' } },
      deps,
    )
    expect(result).toEqual({ sent: true, slug: 'reroll-delivered' })
    expect(deps.childCount).toHaveBeenCalledWith('job-original')
    const [mail] = (deps.sendMail as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(mail.subject).toMatch(/Take 2/)
  })

  it('sends track-not-made for a rejected job', async () => {
    const deps = makeDeps()
    const result = await handleSongJobWebhook(
      { type: 'UPDATE', record: { ...original, status: 'rejected' }, old_record: { ...original, status: 'in_progress' } },
      deps,
    )
    expect(result).toEqual({ sent: true, slug: 'track-not-made' })
    const [mail] = (deps.sendMail as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(mail.subject).toContain('Midnight City')
  })

  it('does nothing on a no-op transition, and never looks up the email', async () => {
    const deps = makeDeps()
    const result = await handleSongJobWebhook(
      { type: 'UPDATE', record: { ...original, status: 'in_progress' }, old_record: { ...original, status: 'submitted' } },
      deps,
    )
    expect(result).toEqual({ sent: false, slug: null })
    expect(deps.lookupEmail).not.toHaveBeenCalled()
    expect(deps.sendMail).not.toHaveBeenCalled()
  })

  it('is idempotent: does not send twice for the same job and slug', async () => {
    const deps = makeDeps({ alreadySentForJob: vi.fn().mockResolvedValue(true) })
    const result = await handleSongJobWebhook(
      { type: 'UPDATE', record: { ...original, status: 'delivered' }, old_record: { ...original, status: 'in_progress' } },
      deps,
    )
    expect(result).toEqual({ sent: false, slug: 'track-delivered' })
    expect(deps.sendMail).not.toHaveBeenCalled()
    expect(deps.logSend).not.toHaveBeenCalled()
  })

  it('does nothing for an unknown user (no email on file)', async () => {
    const deps = makeDeps({ lookupEmail: vi.fn().mockResolvedValue(null) })
    const result = await handleSongJobWebhook(
      { type: 'UPDATE', record: { ...original, status: 'delivered' }, old_record: { ...original, status: 'in_progress' } },
      deps,
    )
    expect(result).toEqual({ sent: false, slug: 'track-delivered' })
    expect(deps.sendMail).not.toHaveBeenCalled()
  })

  it('does not log a send that the mailer reports as failed, so a later retry is not blocked', async () => {
    const deps = makeDeps({ sendMail: vi.fn().mockResolvedValue(false) })
    const result = await handleSongJobWebhook(
      { type: 'UPDATE', record: { ...original, status: 'delivered' }, old_record: { ...original, status: 'in_progress' } },
      deps,
    )
    expect(result).toEqual({ sent: false, slug: 'track-delivered' })
    expect(deps.logSend).not.toHaveBeenCalled()
  })
})
