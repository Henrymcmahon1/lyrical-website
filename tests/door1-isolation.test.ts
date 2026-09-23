import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { classifySlug, handleSongJobWebhook, type SongJobRecord } from '@/lib/song-job-hook'
import { runRatingReminders } from '@/lib/rating-reminder-hook'
import { exportAccountData } from '@/lib/account-data'

/**
 * Door 1 must never leak into Door 2 (README contract, "Side effects that must NOT fire").
 *
 * A Door 1 job is owned by info@'s auth uid, so under RLS it IS info@'s row: every customer
 * surface that would show or act on "my songs" has to exclude `delivery_profile='door1'`
 * explicitly. One test per isolation point, plus a source guard that fails when a new
 * customer-path `song_jobs` read or update is added without the exclusion.
 */

const DOOR2: SongJobRecord & { delivery_profile: string; route: string } = {
  id: 'job-2',
  user_id: 'user-info',
  title: 'A Song',
  target_language: 'ES',
  status: 'in_progress',
  parent_job_id: null,
  reroll_index: 0,
  delivery_profile: 'door2',
  route: 'auto',
}
const DOOR1 = { ...DOOR2, id: 'job-1', delivery_profile: 'door1', route: 'door1' }

function hookDeps() {
  return {
    alreadySentForJob: vi.fn(async () => false),
    lookupEmail: vi.fn(async () => 'info@lyricalglobal.com'),
    childCount: vi.fn(async () => 0),
    sendMail: vi.fn(async () => true),
    logSend: vi.fn(async () => undefined),
  }
}

describe('song-job webhook (lib/song-job-hook.ts): no customer email for Door 1', () => {
  it.each(['delivered', 'rejected'])('a Door 1 move to %s earns no email and touches nothing', async (to) => {
    expect(classifySlug({ ...DOOR1, status: to }, DOOR1)).toBeNull()
    const deps = hookDeps()
    const r = await handleSongJobWebhook({ type: 'UPDATE', record: { ...DOOR1, status: to }, old_record: DOOR1 }, deps)
    expect(r).toEqual({ sent: false, slug: null })
    for (const fn of Object.values(deps)) expect(fn).not.toHaveBeenCalled()
  })

  it('is excluded by route alone too (belt and braces)', () => {
    expect(classifySlug({ ...DOOR2, route: 'door1', status: 'delivered' }, DOOR2)).toBeNull()
  })

  it('still mails a Door 2 delivery (control)', () => {
    expect(classifySlug({ ...DOOR2, status: 'delivered' }, DOOR2)).toBe('track-delivered')
  })
})

describe('rating reminder: never for Door 1', () => {
  it('runRatingReminders skips a Door 1 job even if the query let one through', async () => {
    const sendMail = vi.fn(async () => true)
    const r = await runRatingReminders({
      dueJobs: async () => [{ id: 'job-1', user_id: 'u', title: 't', delivery_profile: 'door1' }],
      alreadyReminded: async () => false,
      emailPrefs: async () => ({ email: 'a@b.test', productEmails: true, ratingReminders: true }),
      productEmailAllowedToday: async () => true,
      sendMail,
      logSend: async () => undefined,
    })
    expect(sendMail).not.toHaveBeenCalled()
    expect(r.sent).toEqual([])
  })

  it('the cron route query excludes Door 1 in the database', () => {
    const src = readFileSync('app/api/hooks/rating-reminder/route.ts', 'utf8')
    expect(src).toMatch(/\.neq\('delivery_profile', 'door1'\)/)
  })
})

describe('account data export (lib/account-data.ts)', () => {
  it('excludes Door 1 jobs and their deliveries from "download my data"', async () => {
    const calls: unknown[][] = []
    const rows: Record<string, unknown[]> = {
      song_jobs: [{ id: 'job-2' }],
      job_feedback: [],
      song_credits: [],
      song_job_deliveries: [
        { job_id: 'job-2', kind: 'cover' },
        { job_id: 'job-1', kind: 'vocal' },
      ],
    }
    const admin = {
      from: (t: string) => {
        const chain: Record<string, unknown> = {}
        for (const m of ['select', 'eq', 'neq']) {
          chain[m] = (...a: unknown[]) => {
            calls.push([t, m, ...a])
            return chain
          }
        }
        chain.order = async () => ({ data: rows[t], error: null })
        return chain
      },
    }
    const out = await exportAccountData(admin as never, 'user-info')
    expect(calls).toContainEqual(['song_jobs', 'neq', 'delivery_profile', 'door1'])
    expect(out.deliveries).toEqual([{ job_id: 'job-2', kind: 'cover' }])
  })
})

describe('/listen never touches jobs or Door 1 files', () => {
  it('reads only the listen bucket', () => {
    for (const f of ['app/listen/actions.ts', 'app/listen/page.tsx', 'lib/listen-audio.ts']) {
      const src = readFileSync(f, 'utf8')
      expect(src).not.toMatch(/song_jobs|song_job_deliveries|'door1'/)
    }
  })
})

describe('credits and entitlement', () => {
  it('the Door 1 actions never touch credits, subscriptions or entitlement', () => {
    const src = readFileSync('app/admin/door1/actions.ts', 'utf8')
    expect(src).not.toMatch(/song_credits|consumeCredit|getEntitlementFor|subscriptions|quota_consumed_at/)
  })

  it('the plan-quota count excludes Door 1 (lib/entitlement-db.ts)', () => {
    expect(readFileSync('lib/entitlement-db.ts', 'utf8')).toMatch(/\.neq\('delivery_profile', 'door1'\)/)
  })
})

/**
 * The source guard. Every `from('song_jobs')` READ or UPDATE on a customer path must carry
 * `.neq('delivery_profile', 'door1')`. Inserts and rollback deletes are Door 2's own writes and
 * are not counted. A new unfiltered query makes the count fall short and this test fail.
 */
const CUSTOMER_PATHS = [
  'app/studio/page.tsx',
  'app/studio/layout.tsx',
  'app/studio/account/page.tsx',
  'app/studio/feedback-actions.ts',
  'app/studio/lyrics-actions.ts',
  'app/studio/reroll-actions.ts',
  'app/studio/self-serve-actions.ts',
  'app/api/hooks/rating-reminder/route.ts',
  'app/api/hooks/song-job/route.ts',
  'lib/account-data.ts',
  'lib/entitlement-db.ts',
]

describe('source guard: every customer-path song_jobs read excludes Door 1', () => {
  it.each(CUSTOMER_PATHS)('%s', (file) => {
    const src = readFileSync(file, 'utf8')
    const reads = [...src.matchAll(/from\('song_jobs'\)\s*\.(\w+)\(/g)].filter(
      (m) => m[1] !== 'insert' && m[1] !== 'delete',
    ).length
    const guards = (src.match(/\.neq\('delivery_profile', 'door1'\)/g) ?? []).length
    expect(reads, `${file} has song_jobs reads`).toBeGreaterThan(0)
    expect(guards, `${file}: ${reads} song_jobs reads/updates, ${guards} door1 exclusions`).toBeGreaterThanOrEqual(reads)
  })

  it('covers every app/studio file that queries song_jobs', async () => {
    const { readdirSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((e) => {
        const p = join(d, e)
        return statSync(p).isDirectory() ? walk(p) : [p.replace(/\\/g, '/')]
      })
    const studio = walk('app/studio').filter((f) => /\.tsx?$/.test(f))
    const querying = studio.filter((f) =>
      [...readFileSync(f, 'utf8').matchAll(/from\('song_jobs'\)\s*\.(\w+)\(/g)].some(
        (m) => m[1] !== 'insert' && m[1] !== 'delete',
      ),
    )
    for (const f of querying) expect(CUSTOMER_PATHS).toContain(f)
  })
})
