import { describe, expect, it, vi, beforeEach } from 'vitest'
import { runRatingReminders, type RatingReminderDeps, type DueJob } from '@/lib/rating-reminder-hook'

/**
 * The orchestration behind `app/api/hooks/rating-reminder/route.ts`. `deps.dueJobs` is expected
 * to already be the DB-filtered set (delivered 24-48h ago, no job_feedback row); this layer adds
 * the cap of one email per person per run, the already-reminded check, and the opt-out /
 * once-a-day product-email gate.
 */

const jobA: DueJob = { id: 'job-a', user_id: 'user-1', title: 'Midnight City' }
const jobB: DueJob = { id: 'job-b', user_id: 'user-1', title: 'Take On Me' } // same user as A
const jobC: DueJob = { id: 'job-c', user_id: 'user-2', title: 'Africa' }

function makeDeps(overrides: Partial<RatingReminderDeps> = {}): RatingReminderDeps {
  return {
    dueJobs: vi.fn().mockResolvedValue([jobA, jobB, jobC]),
    alreadyReminded: vi.fn().mockResolvedValue(false),
    emailPrefs: vi.fn().mockResolvedValue({ email: 'x@example.com', productEmails: true, ratingReminders: true }),
    productEmailAllowedToday: vi.fn().mockResolvedValue(true),
    sendMail: vi.fn().mockResolvedValue(true),
    logSend: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('runRatingReminders', () => {
  it('sends one reminder per eligible job owner', async () => {
    const deps = makeDeps()
    const result = await runRatingReminders(deps)
    // user-1 owns job-a and job-b: only the first is mailed. user-2 owns job-c: mailed too.
    expect(result.sent).toEqual(['job-a', 'job-c'])
    expect(deps.sendMail).toHaveBeenCalledTimes(2)
  })

  it('caps at one email per person per run, even with two eligible jobs', async () => {
    const deps = makeDeps()
    await runRatingReminders(deps)
    const subjects = (deps.sendMail as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0].subject)
    expect(subjects.some((s: string) => s.includes('Midnight City'))).toBe(true)
    expect(subjects.some((s: string) => s.includes('Take On Me'))).toBe(false)
  })

  it('skips a job already reminded', async () => {
    const deps = makeDeps({
      alreadyReminded: vi.fn((jobId: string) => Promise.resolve(jobId === 'job-a')),
    })
    const result = await runRatingReminders(deps)
    expect(result.sent).not.toContain('job-a')
    expect(result.sent).toContain('job-c')
  })

  it('respects the opt-out: product_emails false skips the person entirely', async () => {
    const deps = makeDeps({
      emailPrefs: vi.fn((userId: string) =>
        Promise.resolve(
          userId === 'user-1'
            ? { email: 'a@example.com', productEmails: false, ratingReminders: true }
            : { email: 'b@example.com', productEmails: true, ratingReminders: true },
        ),
      ),
    })
    const result = await runRatingReminders(deps)
    expect(result.sent).toEqual(['job-c'])
  })

  it('respects rating_reminders false specifically', async () => {
    const deps = makeDeps({
      emailPrefs: vi.fn((userId: string) =>
        Promise.resolve(
          userId === 'user-1'
            ? { email: 'a@example.com', productEmails: true, ratingReminders: false }
            : { email: 'b@example.com', productEmails: true, ratingReminders: true },
        ),
      ),
    })
    const result = await runRatingReminders(deps)
    expect(result.sent).toEqual(['job-c'])
  })

  it('respects the daily product-email cap', async () => {
    const deps = makeDeps({
      productEmailAllowedToday: vi.fn((userId: string) => Promise.resolve(userId !== 'user-1')),
    })
    const result = await runRatingReminders(deps)
    expect(result.sent).toEqual(['job-c'])
  })

  it('skips a person with no email on file', async () => {
    const deps = makeDeps({
      emailPrefs: vi.fn((userId: string) =>
        Promise.resolve(
          userId === 'user-1'
            ? { email: null, productEmails: true, ratingReminders: true }
            : { email: 'b@example.com', productEmails: true, ratingReminders: true },
        ),
      ),
    })
    const result = await runRatingReminders(deps)
    expect(result.sent).toEqual(['job-c'])
  })

  it('logs only a send that actually went out', async () => {
    const deps = makeDeps({ sendMail: vi.fn().mockResolvedValue(false) })
    const result = await runRatingReminders(deps)
    expect(result.sent).toEqual([])
    expect(deps.logSend).not.toHaveBeenCalled()
  })

  it('logs the successful sends with the right slug', async () => {
    const deps = makeDeps()
    await runRatingReminders(deps)
    expect(deps.logSend).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', slug: 'rating-reminder', jobId: 'job-a' }),
    )
  })

  it('does nothing when there are no due jobs', async () => {
    const deps = makeDeps({ dueJobs: vi.fn().mockResolvedValue([]) })
    const result = await runRatingReminders(deps)
    expect(result).toEqual({ sent: [], skipped: 0 })
    expect(deps.sendMail).not.toHaveBeenCalled()
  })
})
