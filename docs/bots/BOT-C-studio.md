# Bot C: Door-2 studio (feedback, re-rolls, licence gate, plan card, staff feedback tab)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Paste this to start the session:**
> Read `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` then `docs/bots/BOT-C-studio.md` in `C:\Users\User\CascadeProjects\lyrical-website`. Work on branch `feat/v2-studio` off `develop`. Never touch `main`. Execute the brief task by task, tests first. `npm test && npm run build` green before the PR. Bot 0 must already be merged into `develop` (`lib/plans.ts`, `lib/entitlement.ts`, `docs/v2/copy-deck.md`, migrations applied); if any is missing, stop and tell me.

**Goal:** Turn the studio into the Door-2 product: a plan card, a song list with re-rolls nested as "Take 2" and "Take 3", a feedback bar on every delivered track (thumbs up, thumbs down with a required note), a re-roll button gated by the spec rules, the personal-use licence gate on submit, beta copy on sign-in, and a Feedback tab plus CSV export in the staff console.

**Architecture:** Customer-facing reads use the USER's Supabase client so RLS decides the rows; `song_jobs` carries a column grant, so every studio query names its columns. Feedback writes with the user's client (RLS insert/update on `job_feedback`). The re-roll is the one privileged write: it stamps `pipeline_state='queued'`, which spends render money, so it runs on the service-role client after the session and the spec rules are checked, exactly as `submitSelfServeJob` does. Bot F's poller picks the child row up through the same Supabase contract.

**Tech Stack:** Next 16 (App Router, async `searchParams`/`cookies`), React 19 (`useActionState`), TypeScript, Vitest + `react-dom/server` render tests, Supabase (`@supabase/ssr` user client, `supabase-js` admin client), zod 4.

**Spec:** `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` (§6 is this brief; §3 tables, §4 entitlement, §11 ownership, §12 constraints). Strings come from `docs/v2/copy-deck.md` verbatim.

## Global Constraints

- Branch `feat/v2-studio` off `develop`. PR into `develop`. Never touch `main`, the `lyrical-website` Vercel project, or lyricalglobal.com.
- No em dashes anywhere (code, comments, copy, commit messages).
- No secrets in files. Service-role reads only where this brief says so.
- Brand (`CLAUDE.md`): lowercase `lyrical`, US spelling in visitor copy (the deck's "favorite" is a deck string, used as written), never "AI-generated", no gradients, ember never carries body text.
- `song_jobs` has a COLUMN grant: never `select *` on it from a customer path. Customer-readable new columns are `parent_job_id, reroll_index, licence_terms_version, delivery_profile`. `seed`, `pipeline_error`, `internal_notes` stay service-role only.
- Shared file `app/studio/self-serve-actions.ts`: Bot A owns the entitlement block. You change two lines (the schema it parses, the licence stamp on the insert) plus one profile stamp. Bot A merges first; you rebase.
- `components/Nav.tsx` is Bot B's. Your billing link lives inside the studio page.
- Customers cannot read `pipeline_error`, so the studio keys the closed-window copy off `status='rejected'` on a child. Bot F's poller must set `status='rejected'` as well as `pipeline_error='stems_expired'`. Say so in the PR body.

## File structure

| File | Responsibility |
|---|---|
| `lib/terms.ts` | add `LICENCE_TERMS_VERSION`, `LICENCE_TERMS_INTRO`, `LICENCE_TERMS_POINTS` |
| `lib/feedback-schema.ts` | zod: rating, note rule, tag list |
| `lib/song-job-schema.ts` | add `SelfServeJobSchema` = `SongJobSchema` + `licenceAccepted: z.literal(true)` |
| `app/studio/feedback-actions.ts` | `submitFeedback` (user client, upsert) + `useActionState` wrapper |
| `app/studio/reroll-actions.ts` | `requestReroll` (service role, spec rules) + wrapper |
| `components/FeedbackBar.tsx` | client bar: thumbs, note, chips, save, re-roll button |
| `app/studio/page.tsx` | rewrite: plan card, nested takes, licence line, heartbeat line |
| `app/studio/new/page.tsx`, `components/SongSubmitForm.tsx`, `app/studio/self-serve-actions.ts` | entitlement redirect, licence checkbox, licence stamp |
| `app/studio/sign-in/page.tsx` | beta copy |
| `app/queue/FeedbackTab.tsx`, `app/queue/page.tsx`, `app/queue/export/route.ts` | staff Feedback tab + CSV |
| `tests/feedback-*.test.ts(x)` | every test in this brief |

---

### Task 1: Branch and licence terms

**Files:** modify `lib/terms.ts`; create `tests/feedback-licence-terms.test.ts`

- [ ] **Step 1: Branch**

```bash
git checkout develop && git pull && git checkout -b feat/v2-studio
ls lib/plans.ts lib/entitlement.ts docs/v2/copy-deck.md
```

All three must exist. If not, stop: Bot 0 is not merged.

- [ ] **Step 2: Failing test**

```ts
import { describe, expect, it } from 'vitest'
import { LICENCE_TERMS_POINTS, LICENCE_TERMS_VERSION } from '@/lib/terms'

describe('the personal-use licence', () => {
  it('is versioned and keeps the five points the beta relies on', () => {
    expect(LICENCE_TERMS_VERSION).toBe('2026-09-22')
    expect(LICENCE_TERMS_POINTS).toHaveLength(5)
    const all = LICENCE_TERMS_POINTS.join(' ')
    for (const re of [/personal, non-commercial/, /streaming/, /official release/, /provenance mark/, /re-rolls/]) expect(all).toMatch(re)
    expect(all).not.toMatch(/\u2014/)
  })
})
```

- [ ] **Step 3: Run, expect FAIL** `npx vitest run tests/feedback-licence-terms.test.ts`

- [ ] **Step 4: Append to `lib/terms.ts`**

```ts
/**
 * The Door-2 personal-use licence. Plain product terms for beta output, not counsel's text.
 * Stamped on `song_jobs.licence_terms_version` at submit and copied onto every re-roll child,
 * so a delivered file always traces to the terms it was made under. Bump on any edit.
 */
export const LICENCE_TERMS_VERSION = '2026-09-22'
export const LICENCE_TERMS_INTRO = 'This is beta output for you to enjoy. By making a track you agree that:'
export const LICENCE_TERMS_POINTS = [
  'The track is for your personal, non-commercial use only.',
  'You will not upload it to streaming or sales platforms, or sell it in any form.',
  'You will not present the recording as the artist\u2019s official release.',
  'lyrical may embed an inaudible provenance mark in every file it delivers.',
  'Beta output may contain errors. Your remedy is the free re-rolls that come with every track.',
]
```

- [ ] **Step 5: Run, expect PASS.** Commit: `git add lib/terms.ts tests/feedback-licence-terms.test.ts && git commit -m "feat(terms): personal-use licence v2026-09-22"`

### Task 2: `lib/feedback-schema.ts`

**Files:** create `lib/feedback-schema.ts`, `tests/feedback-schema.test.ts`

**Interfaces:** produces `FEEDBACK_TAGS`, `FeedbackTag`, `MIN_DOWN_NOTE_CHARS`, `DOWN_NOTE_MESSAGE`, `FeedbackSchema`, `FeedbackInput`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { FeedbackSchema, FEEDBACK_TAGS } from '@/lib/feedback-schema'

const JOB = '11111111-2222-3333-4444-555555555555'
const parse = (v: unknown) => FeedbackSchema.safeParse(v)

describe('feedback schema', () => {
  it('up needs no note; down needs twenty trimmed characters', () => {
    expect(parse({ jobId: JOB, rating: 'up' }).success).toBe(true)
    expect(parse({ jobId: JOB, rating: 'down' }).success).toBe(false)
    expect(parse({ jobId: JOB, rating: 'down', note: '   too short      ' }).success).toBe(false)
    const r = parse({ jobId: JOB, rating: 'down', note: '  Verse 2 line 3 is late  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.note).toBe('Verse 2 line 3 is late')
  })
  it('accepts known tags only and defaults to none', () => {
    expect(FEEDBACK_TAGS).toEqual(['timing', 'pronunciation', 'voice', 'meaning', 'mix', 'other'])
    expect(parse({ jobId: JOB, rating: 'up', tags: ['timing', 'mix'] }).success).toBe(true)
    expect(parse({ jobId: JOB, rating: 'up', tags: ['tempo'] }).success).toBe(false)
    const none = parse({ jobId: JOB, rating: 'up' })
    if (none.success) expect(none.data.tags).toEqual([])
  })
  it('refuses a rating that is not up or down, and a malformed id', () => {
    expect(parse({ jobId: JOB, rating: 'meh' }).success).toBe(false)
    expect(parse({ jobId: 'x', rating: 'up' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run, expect FAIL.** `npx vitest run tests/feedback-schema.test.ts`

- [ ] **Step 3: Implement**

```ts
import { z } from 'zod'

/**
 * One rating per job per user. The database mirrors the note rule
 * (`job_feedback_down_needs_note`, 20 trimmed characters) so a forged request cannot save a
 * bare thumbs-down; this schema gives the customer a readable reason first.
 */
export const FEEDBACK_TAGS = ['timing', 'pronunciation', 'voice', 'meaning', 'mix', 'other'] as const
export type FeedbackTag = (typeof FEEDBACK_TAGS)[number]
export const MIN_DOWN_NOTE_CHARS = 20
export const DOWN_NOTE_MESSAGE = 'Tell us what is wrong in at least 20 characters, so the re-roll can fix it.'

export const FeedbackSchema = z
  .object({
    jobId: z.string().regex(/^[0-9a-f-]{36}$/i),
    rating: z.enum(['up', 'down']),
    note: z.string().trim().max(4000).optional(),
    tags: z.array(z.enum(FEEDBACK_TAGS)).max(FEEDBACK_TAGS.length).default([]),
  })
  .refine((v) => v.rating !== 'down' || (v.note ?? '').length >= MIN_DOWN_NOTE_CHARS, {
    path: ['note'],
    message: DOWN_NOTE_MESSAGE,
  })
export type FeedbackInput = z.infer<typeof FeedbackSchema>
```

- [ ] **Step 4: Run, expect PASS.** Commit: `git add lib/feedback-schema.ts tests/feedback-schema.test.ts && git commit -m "feat(feedback): rating schema"`

### Task 3: `app/studio/feedback-actions.ts`

**Files:** create `app/studio/feedback-actions.ts`, `tests/feedback-actions.test.ts`

**Interfaces:** consumes `FeedbackSchema`, `currentUser`, `supabaseServer`. Produces `FeedbackResult`, `submitFeedback(raw: unknown)`, `submitFeedbackForm(prev, formData)` (the `useActionState` shape, also the no-JS form action).

- [ ] **Step 1: Failing tests** (fake-client style of `tests/lyrics-update.test.ts`)

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const upsert = vi.fn()
const maybeSingle = vi.fn()
const currentUser = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: async () => ({
    from: (table: string) =>
      table === 'song_jobs'
        ? { select: () => ({ eq: () => ({ maybeSingle }) }) }
        : { upsert: (...a: unknown[]) => upsert(...a) },
  }),
  currentUser: () => currentUser(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { submitFeedback, submitFeedbackForm } = await import('@/app/studio/feedback-actions')
const JOB = '11111111-2222-3333-4444-555555555555'

beforeEach(() => {
  vi.clearAllMocks()
  currentUser.mockResolvedValue({ id: 'user-1' })
  maybeSingle.mockResolvedValue({ data: { id: JOB }, error: null })
  upsert.mockResolvedValue({ error: null })
})

describe('submitFeedback', () => {
  it('refuses without a session, without a note on a thumbs-down, or on a job the user cannot see', async () => {
    currentUser.mockResolvedValueOnce(null)
    expect((await submitFeedback({ jobId: JOB, rating: 'up' })).ok).toBe(false)
    expect((await submitFeedback({ jobId: JOB, rating: 'down', note: 'short' })).ok).toBe(false)
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect((await submitFeedback({ jobId: JOB, rating: 'up' })).ok).toBe(false)
    expect(upsert).not.toHaveBeenCalled()
  })
  it('upserts on (job_id, user_id) with the user id from the session', async () => {
    const r = await submitFeedback({ jobId: JOB, rating: 'down', note: 'Chorus line 2 lands late', tags: ['timing'] })
    expect(r).toEqual({ ok: true })
    expect(upsert).toHaveBeenCalledWith(
      { job_id: JOB, user_id: 'user-1', rating: 'down', note: 'Chorus line 2 lands late', tags: ['timing'] },
      { onConflict: 'job_id,user_id' },
    )
  })
  it('reports a refused write instead of pretending', async () => {
    upsert.mockResolvedValue({ error: { message: 'rls' } })
    expect((await submitFeedback({ jobId: JOB, rating: 'up' })).ok).toBe(false)
  })
  it('reads a plain form post the same way', async () => {
    const fd = new FormData()
    fd.set('jobId', JOB); fd.set('rating', 'up'); fd.append('tags', 'voice')
    expect(await submitFeedbackForm(null, fd)).toEqual({ ok: true })
    expect((upsert.mock.calls[0][0] as { tags: string[] }).tags).toEqual(['voice'])
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { FeedbackSchema } from '@/lib/feedback-schema'
import { currentUser, supabaseServer } from '@/lib/supabase-server'

/**
 * One rating per delivered track. Runs with the USER's client so `job_feedback` RLS is the
 * control: insert and update only where `auth.uid() = user_id`. The song_jobs lookup is the
 * user's client too, so a job id that is not theirs finds nothing and nothing is written.
 */
export type FeedbackResult = { ok: true } | { ok: false; error: string }

export async function submitFeedback(raw: unknown): Promise<FeedbackResult> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Your session expired. Sign in and try again.' }
  const parsed = FeedbackSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Something in the form is not right.' }
  }
  const { jobId, rating, note, tags } = parsed.data

  const supabase = await supabaseServer()
  const { data: job } = await supabase.from('song_jobs').select('id').eq('id', jobId).maybeSingle()
  if (!job) return { ok: false, error: 'That song could not be found.' }

  const { error } = await supabase
    .from('job_feedback')
    .upsert({ job_id: jobId, user_id: user.id, rating, note: note || null, tags }, { onConflict: 'job_id,user_id' })
  if (error) {
    console.error('[feedback] upsert refused', error)
    return { ok: false, error: 'We could not save that. Try again in a moment.' }
  }
  revalidatePath('/studio')
  return { ok: true }
}

/** `useActionState` shape. Also what a no-JS form post calls, so the bar works without React. */
export async function submitFeedbackForm(_prev: FeedbackResult | null, formData: FormData): Promise<FeedbackResult> {
  return submitFeedback({
    jobId: formData.get('jobId'),
    rating: formData.get('rating'),
    note: String(formData.get('note') ?? '') || undefined,
    tags: formData.getAll('tags'),
  })
}
```

- [ ] **Step 4: Run, expect PASS.** Commit: `git add app/studio/feedback-actions.ts tests/feedback-actions.test.ts && git commit -m "feat(feedback): submitFeedback with the user's client"`

### Task 4: `app/studio/reroll-actions.ts`

**Files:** create `app/studio/reroll-actions.ts`, `tests/feedback-reroll.test.ts`

**Interfaces:** consumes `REROLLS_PER_TRACK` (lib/plans), `currentUser`, `supabaseAdmin`. Produces `RerollResult`, `REROLL_CLOSED`, `requestReroll(jobId)`, `requestRerollForm(prev, formData)`.

- [ ] **Step 1: Failing tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const currentUser = vi.fn()
const jobRow = vi.fn()
const childCount = vi.fn()
const feedbackRow = vi.fn()
const insert = vi.fn()
vi.mock('@/lib/supabase-server', () => ({ currentUser: () => currentUser() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'job_feedback') {
        const c = { select: () => c, eq: () => c, not: () => c, maybeSingle: () => feedbackRow() }
        return c
      }
      const c = {
        select: (_cols: string, opts?: { head?: boolean }) => (opts?.head ? { eq: () => childCount() } : c),
        eq: () => c,
        maybeSingle: () => jobRow(),
        insert: (row: unknown) => ({ select: () => ({ single: () => insert(row) }) }),
      }
      return c
    },
  }),
}))

const { requestReroll } = await import('@/app/studio/reroll-actions')
const JOB = '11111111-2222-3333-4444-555555555555'
const CHILD = '22222222-2222-3333-4444-555555555555'
const BASE = {
  id: JOB, user_id: 'user-1', status: 'delivered', parent_job_id: null, title: 'A Song',
  primary_artist: 'An Artist', source_language: 'EN', target_language: 'ES', lyrics: 'la',
  voice_id: null, voice_preference: 'female', licence_terms_version: '2026-09-22',
}

beforeEach(() => {
  vi.clearAllMocks()
  currentUser.mockResolvedValue({ id: 'user-1' })
  jobRow.mockResolvedValue({ data: BASE, error: null })
  childCount.mockResolvedValue({ count: 0, error: null })
  feedbackRow.mockResolvedValue({ data: { id: 'fb-1' }, error: null })
  insert.mockResolvedValue({ data: { id: 'child-1' }, error: null })
})

describe('requestReroll rules', () => {
  it('needs a session, an owned job (the scoped query misses otherwise) and a delivered status', async () => {
    currentUser.mockResolvedValueOnce(null)
    expect((await requestReroll(JOB)).ok).toBe(false)
    jobRow.mockResolvedValueOnce({ data: null, error: null })
    expect((await requestReroll(JOB)).ok).toBe(false)
    jobRow.mockResolvedValueOnce({ data: { ...BASE, status: 'approved' }, error: null })
    expect((await requestReroll(JOB)).ok).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })
  it('refuses when the family already has two children, with the closed-window copy', async () => {
    childCount.mockResolvedValue({ count: 2, error: null })
    const r = await requestReroll(JOB)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/re-roll window/)
    expect(insert).not.toHaveBeenCalled()
  })
  it('needs a thumbs-down with a note on the job being re-rolled', async () => {
    feedbackRow.mockResolvedValue({ data: null, error: null })
    expect((await requestReroll(JOB)).ok).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })
  it('inserts the child with parent = the ORIGINAL, index = children + 1, queued, nothing else copied', async () => {
    jobRow.mockResolvedValue({ data: { ...BASE, id: CHILD, parent_job_id: JOB }, error: null })
    childCount.mockResolvedValue({ count: 1, error: null })
    expect((await requestReroll(CHILD)).ok).toBe(true)
    const row = insert.mock.calls[0][0] as Record<string, unknown>
    expect(row).toMatchObject({
      user_id: 'user-1', parent_job_id: JOB, reroll_index: 2, route: 'auto', pipeline_state: 'queued',
      status: 'approved', quota_consumed_at: null, licence_terms_version: '2026-09-22', title: 'A Song',
      primary_artist: 'An Artist', source_language: 'EN', target_language: 'ES', lyrics: 'la',
      voice_id: null, voice_preference: 'female',
    })
    expect(Number.isInteger(row.seed)).toBe(true)
    expect(typeof row.approved_at).toBe('string')
    expect(row).not.toHaveProperty('notes')
    expect(row).not.toHaveProperty('id')
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
'use server'

import { randomInt } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { REROLLS_PER_TRACK } from '@/lib/plans'
import { currentUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * A free re-roll of a delivered track. Privileged (service role) because the child row carries
 * `pipeline_state='queued'`, the trigger that spends render money, and the customer's own
 * client must never set it. Rules, all checked before the insert: owner, delivered, family
 * under the cap, a thumbs-down with a note on THIS job. The child hangs off the ORIGINAL, never
 * off another child, so the poller finds stems under `work/website/<original>/`. No
 * `song_job_assets` rows: the poller resolves stems from the parent.
 */
export type RerollResult = { ok: true; childId: string } | { ok: false; error: string }
export const REROLL_CLOSED = 'The re-roll window for this song has closed. Make it again to start fresh.'
const JOB_COLUMNS =
  'id, user_id, status, parent_job_id, title, primary_artist, source_language, target_language, lyrics, voice_id, voice_preference, licence_terms_version'

export async function requestReroll(jobId: string): Promise<RerollResult> {
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Your session expired. Sign in and try again.' }
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return { ok: false, error: 'That song could not be found.' }

  const admin = supabaseAdmin()
  const { data: job } = await admin.from('song_jobs').select(JOB_COLUMNS).eq('id', jobId).eq('user_id', user.id).maybeSingle()
  if (!job) return { ok: false, error: 'That song could not be found.' }
  if (job.status !== 'delivered') return { ok: false, error: 'A track can be re-rolled once it has been delivered.' }

  const original = job.parent_job_id ?? job.id
  const { count } = await admin.from('song_jobs').select('id', { count: 'exact', head: true }).eq('parent_job_id', original)
  const children = count ?? 0
  if (children >= REROLLS_PER_TRACK) return { ok: false, error: REROLL_CLOSED }

  const { data: down } = await admin
    .from('job_feedback').select('id')
    .eq('job_id', jobId).eq('user_id', user.id).eq('rating', 'down').not('note', 'is', null)
    .maybeSingle()
  if (!down) return { ok: false, error: 'Tell us what is wrong with this take first, then re-roll it.' }

  const { data: child, error } = await admin
    .from('song_jobs')
    .insert({
      user_id: user.id,
      parent_job_id: original,
      reroll_index: children + 1,
      seed: randomInt(0, 2 ** 31),
      title: job.title,
      primary_artist: job.primary_artist,
      source_language: job.source_language,
      target_language: job.target_language,
      lyrics: job.lyrics,
      voice_id: job.voice_id,
      voice_preference: job.voice_preference,
      licence_terms_version: job.licence_terms_version,
      route: 'auto',
      pipeline_state: 'queued',
      status: 'approved',
      approved_at: new Date().toISOString(),
      quota_consumed_at: null,
    })
    .select('id')
    .single()
  if (error || !child) {
    console.error('[reroll] insert refused', error)
    return { ok: false, error: 'We could not start that re-roll. Try again in a moment.' }
  }
  revalidatePath('/studio')
  return { ok: true, childId: child.id }
}

export async function requestRerollForm(_prev: RerollResult | null, formData: FormData): Promise<RerollResult> {
  return requestReroll(String(formData.get('jobId') ?? ''))
}
```

- [ ] **Step 4: Run, expect PASS.** Commit: `git add app/studio/reroll-actions.ts tests/feedback-reroll.test.ts && git commit -m "feat(reroll): requestReroll with the spec rules"`

### Task 5: `components/FeedbackBar.tsx`

**Files:** create `components/FeedbackBar.tsx`, `tests/feedback-bar.test.tsx`

**Interfaces:** `FeedbackBar({ jobId, existing, rerollsLeft, canReroll })`. `existing` is the user's saved row or null; `rerollsLeft` is `rerollsLeft(childCount)` from `lib/entitlement`, computed by the page; `canReroll` is true only on a delivered job. `useActionState` renders its initial state under `react-dom/server`, so no React mock is needed.

- [ ] **Step 1: Failing render test**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/app/studio/feedback-actions', () => ({ submitFeedbackForm: vi.fn() }))
vi.mock('@/app/studio/reroll-actions', () => ({ requestRerollForm: vi.fn() }))
const { FeedbackBar } = await import('@/components/FeedbackBar')
const JOB = '11111111-2222-3333-4444-555555555555'
const DOWN = { rating: 'down' as const, note: 'Verse 2 is a beat late', tags: ['timing'] }
const html = (p: Partial<Parameters<typeof FeedbackBar>[0]> = {}) =>
  renderToStaticMarkup(<FeedbackBar jobId={JOB} existing={null} rerollsLeft={2} canReroll {...p} />)

describe('FeedbackBar', () => {
  it('is a real form with both thumbs, the job id, the deck prompt and the six chips', () => {
    const h = html({ existing: { ...DOWN, note: '' } })
    expect(h).toMatch(/<form/)
    expect(h).toContain(`value="${JOB}"`)
    expect(h).toMatch(/aria-label="Thumbs up"/)
    expect(h).toMatch(/aria-label="Thumbs down"/)
    expect(h).toContain('Tell us exactly what is wrong')
    for (const t of ['timing', 'pronunciation', 'voice', 'meaning', 'mix', 'other']) expect(h).toContain(`value="${t}"`)
  })
  it('shows re-roll with the count after a saved thumbs-down, disabled with the closed copy at zero', () => {
    expect(html({ existing: DOWN, rerollsLeft: 1 })).toContain('Re-roll this track (1 left)')
    const zero = html({ existing: DOWN, rerollsLeft: 0 })
    expect(zero).toContain('The re-roll window for this song has closed.')
    expect(zero).toMatch(/<button[^>]*disabled/)
  })
  it('never shows re-roll after a thumbs-up or before anything is saved', () => {
    expect(html({ existing: { rating: 'up', note: null, tags: [] } })).not.toContain('Re-roll this track')
    expect(html()).not.toContain('Re-roll this track')
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
'use client'

import { useActionState, useState } from 'react'
import { submitFeedbackForm, type FeedbackResult } from '@/app/studio/feedback-actions'
import { requestRerollForm, type RerollResult } from '@/app/studio/reroll-actions'
import { FEEDBACK_TAGS, MIN_DOWN_NOTE_CHARS } from '@/lib/feedback-schema'

/**
 * The feedback loop is the product. Thumbs are radios inside a real form, so the bar posts
 * without JavaScript; React adds the live prompt switch and the pending state. A thumbs-down
 * needs a detailed note before it saves, and only a saved thumbs-down unlocks the re-roll.
 * Copy strings are the deck's, verbatim.
 */
export type ExistingFeedback = { rating: 'up' | 'down'; note: string | null; tags: string[] } | null

const DOWN_PROMPT =
  'Tell us exactly what is wrong: which line, what time in the song, is it timing, pronunciation, the voice, or the meaning of the words? The more you write, the better the re-roll.'
const UP_PROMPT = 'Anything you loved, or anything small to fix? (optional)'
const REROLL_CLOSED = 'The re-roll window for this song has closed. Make it again to start fresh.'
const chip = 'cursor-pointer rounded-card border border-graphite/25 transition-colors has-[:checked]:border-indigo has-[:checked]:bg-indigo/10'
const field = 'w-full rounded-card border border-graphite/20 bg-cream px-4 py-3 text-graphite outline-none focus:border-indigo'
const secondary = 'nudge w-fit rounded-card border border-graphite/25 px-5 py-2.5 text-sm hover:border-indigo hover:text-indigo disabled:opacity-60'

export function FeedbackBar({ jobId, existing, rerollsLeft, canReroll }: {
  jobId: string; existing: ExistingFeedback; rerollsLeft: number; canReroll: boolean
}) {
  const [choice, setChoice] = useState<'up' | 'down' | ''>(existing?.rating ?? '')
  const [saved, save, saving] = useActionState<FeedbackResult | null, FormData>(submitFeedbackForm, null)
  const [rerolled, reroll, rerolling] = useActionState<RerollResult | null, FormData>(requestRerollForm, null)
  const showReroll = canReroll && existing?.rating === 'down' && !!existing.note && !rerolled?.ok

  return (
    <div className="mt-5 border-t border-graphite/12 pt-4">
      <form action={save} className="flex flex-col gap-3">
        <input type="hidden" name="jobId" value={jobId} />
        <fieldset className="flex items-center gap-3">
          <legend className="sr-only">How did this take turn out?</legend>
          {(['up', 'down'] as const).map((r) => (
            <label key={r} className={`${chip} inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-lg`} aria-label={r === 'up' ? 'Thumbs up' : 'Thumbs down'}>
              <input type="radio" name="rating" value={r} className="sr-only" required checked={choice === r} onChange={() => setChoice(r)} />
              <span aria-hidden="true">{r === 'up' ? '\u{1F44D}' : '\u{1F44E}'}</span>
            </label>
          ))}
          {existing && !saved && <span className="text-sm text-graphite/55">Saved. Change it any time.</span>}
        </fieldset>

        {choice && (
          <label className="flex flex-col gap-2">
            <span className="text-sm leading-relaxed text-graphite/75">{choice === 'down' ? DOWN_PROMPT : UP_PROMPT}</span>
            <textarea name="note" rows={4} defaultValue={existing?.note ?? ''} className={field}
              required={choice === 'down'} minLength={choice === 'down' ? MIN_DOWN_NOTE_CHARS : undefined} />
          </label>
        )}
        {choice === 'down' && (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-2 text-sm text-graphite/60">What is it? Pick any.</legend>
            {FEEDBACK_TAGS.map((t) => (
              <label key={t} className={`${chip} rounded-full px-3 py-1.5 text-sm`}>
                <input type="checkbox" name="tags" value={t} className="sr-only" defaultChecked={existing?.tags.includes(t) ?? false} />
                {t}
              </label>
            ))}
          </fieldset>
        )}
        {saved && !saved.ok && <p role="alert" className="text-sm text-graphite">{saved.error}</p>}
        {saved?.ok && <p role="status" className="text-sm text-graphite/70">Thank you. That goes straight into the next take.</p>}
        {choice && (
          <button type="submit" disabled={saving} className={secondary}>
            {saving ? 'Saving\u2026' : existing ? 'Update' : 'Save'}
          </button>
        )}
      </form>

      {showReroll && (
        <form action={reroll} className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="jobId" value={jobId} />
          <button type="submit" disabled={rerollsLeft === 0 || rerolling} className="nudge w-fit rounded-card bg-ember px-6 py-3 text-sm text-cream disabled:opacity-50">
            {rerolling ? 'Starting\u2026' : `Re-roll this track (${rerollsLeft} left)`}
          </button>
          {rerollsLeft === 0 && <p className="text-sm text-graphite/60">{REROLL_CLOSED}</p>}
          {rerolled && !rerolled.ok && <p role="alert" className="text-sm text-graphite">{rerolled.error}</p>}
        </form>
      )}
      {rerolled?.ok && <p role="status" className="mt-4 text-sm text-graphite/70">Re-rolling. The new take will appear under this song as soon as it is ready.</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run, expect PASS.** Commit: `git add components/FeedbackBar.tsx tests/feedback-bar.test.tsx && git commit -m "feat(studio): FeedbackBar"`

### Task 6: Licence gate on submit

**Files:** modify `lib/song-job-schema.ts`, `components/SongSubmitForm.tsx`, `app/studio/self-serve-actions.ts`; create `tests/feedback-licence-form.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SelfServeJobSchema, SongJobSchema } from '@/lib/song-job-schema'

vi.mock('@/lib/supabase-client', () => ({ supabaseBrowser: () => ({}) }))
vi.mock('@/app/studio/submit-actions', () => ({ submitSongJob: vi.fn() }))
vi.mock('@/app/studio/self-serve-actions', () => ({ submitSelfServeJob: vi.fn() }))
const { SongSubmitForm } = await import('@/components/SongSubmitForm')

const asset = (kind: 'instrumental' | 'vocal') => ({ kind, path: `u/j/${kind}.wav`, filename: `${kind}.wav`, bytes: 1000 })
const base = { title: 'T', primaryArtist: 'A', sourceLanguage: 'EN', targetLanguage: 'ES', rightsWarranty: true as const, assets: [asset('instrumental'), asset('vocal')] }

describe('the licence gate', () => {
  it('self-serve requires licenceAccepted: true; the manual schema is untouched', () => {
    expect(SelfServeJobSchema.safeParse(base).success).toBe(false)
    expect(SelfServeJobSchema.safeParse({ ...base, licenceAccepted: false }).success).toBe(false)
    expect(SelfServeJobSchema.safeParse({ ...base, licenceAccepted: true }).success).toBe(true)
    expect(SongJobSchema.safeParse(base).success).toBe(true)
  })
  it('renders the licence box only in self-serve mode', () => {
    expect(renderToStaticMarkup(<SongSubmitForm selfServe />)).toContain('personal, non-commercial')
    expect(renderToStaticMarkup(<SongSubmitForm />)).not.toContain('personal, non-commercial')
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: `lib/song-job-schema.ts`, append after `SongJobInput`**

```ts
/**
 * Door 2 adds the personal-use licence. An intersection rather than `.extend()`, so the
 * refinements on `SongJobSchema` stay as they are and the manual funnel is untouched.
 */
export const SelfServeJobSchema = z.intersection(
  SongJobSchema,
  z.object({ licenceAccepted: z.literal(true, { error: 'Tick the personal-use terms before sending it.' }) }),
)
export type SelfServeJobInput = z.infer<typeof SelfServeJobSchema>
```

- [ ] **Step 4: `components/SongSubmitForm.tsx`**

Import `LICENCE_TERMS_INTRO, LICENCE_TERMS_POINTS` alongside the rights constants from `@/lib/terms`. State next to `warranty`: `const [licence, setLicence] = useState(false)`. In `submit()`, after the warranty check:

```ts
    if (selfServe && !licence) {
      setError('Tick the personal-use terms before sending it.')
      return
    }
```

In the payload after `rightsWarranty: true,`: `licenceAccepted: selfServe ? (true as const) : undefined,`. In the JSX directly after the `<RightsWarranty ... />` block:

```tsx
      {selfServe && (
        <RightsWarranty intro={LICENCE_TERMS_INTRO} points={LICENCE_TERMS_POINTS} checked={licence} onChange={setLicence} />
      )}
```

The closing line under the submit button becomes `{selfServe ? 'Beta output. Personal use only.' : 'Nothing is made until we accept it, and nothing is released without your approval.'}`.

- [ ] **Step 5: `app/studio/self-serve-actions.ts` (your only edits; Bot A owns the rest)**

Import `SelfServeJobSchema` instead of `SongJobSchema` and parse with it: `const parsed = SelfServeJobSchema.safeParse(raw)`. Import `LICENCE_TERMS_VERSION` next to `RIGHTS_TERMS_VERSION`. In the `song_jobs` insert, under `rights_terms_version`, add:

```ts
    licence_terms_version: LICENCE_TERMS_VERSION,
```

After the assets insert succeeds, stamp the profile once (no-op after the first time):

```ts
  await admin.from('profiles').update({ licence_terms_version: LICENCE_TERMS_VERSION }).eq('id', user.id).is('licence_terms_version', null)
```

- [ ] **Step 6: Run all tests, expect PASS** (`tests/lyrics-form.test.tsx` and `tests/song-job-schema.test.ts` still green). Commit: `git commit -am "feat(studio): personal-use licence gate on self-serve submit"`

### Task 7: `/studio/new` entitlement redirect

**Files:** modify `app/studio/new/page.tsx`. If `lib/entitlement-db.ts` is not on `develop` yet, create the temporary copy below with Bot A's signature; on rebase take Bot A's file wholesale.

- [ ] **Step 1: Temporary `lib/entitlement-db.ts` (only if absent)**

```ts
import { computeEntitlement, type Entitlement } from './entitlement'
import { supabaseAdmin } from './supabase-admin'

/** TEMPORARY copy of Bot A's helper, same signature. Replaced by feat/v2-payments on rebase. */
export async function getEntitlementFor(userId: string): Promise<Entitlement> {
  const admin = supabaseAdmin()
  const { data: sub } = await admin
    .from('subscriptions').select('tier, status, current_period_start, current_period_end')
    .eq('user_id', userId).maybeSingle()
  let used = 0
  if (sub?.current_period_start) {
    const { count } = await admin
      .from('song_jobs').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('reroll_index', 0).gte('quota_consumed_at', sub.current_period_start)
    used = count ?? 0
  }
  const { data: credits } = await admin.from('song_credits').select('delta').eq('user_id', userId)
  const balance = (credits ?? []).reduce((n, c) => n + (c.delta as number), 0)
  return computeEntitlement(sub ?? null, used, balance)
}
```

- [ ] **Step 2: `app/studio/new/page.tsx`**

Add `import { getEntitlementFor } from '@/lib/entitlement-db'` and, directly after the sign-in redirect:

```ts
  // No plan, no form. The gate that matters is inside submitSelfServeJob; this is the polite one.
  const entitlement = await getEntitlementFor(user.id)
  if (!entitlement.ok) redirect('/pricing?why=plan')
```

Replace the intro paragraph text with: `Upload your stems, pick a language, and hear it re-sung in the same voice. Beta output. Personal use only.`

- [ ] **Step 3:** `npm run build`. Commit: `git commit -am "feat(studio): /studio/new needs an entitlement"`

### Task 8: Studio home rewrite

**Files:** rewrite `app/studio/page.tsx`; create `tests/feedback-studio-home.test.tsx`

**Interfaces:** consumes `getEntitlementFor`, `planById` (lib/plans), `rerollsLeft` (lib/entitlement), `FeedbackBar`, `CoverPlayer`, `JobStatus`, `LyricsEditor`, `StudioAutoRefresh`, `Scorecard`, `signOut`.

- [ ] **Step 1: Failing render test**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const entitlement = vi.fn()
const tables: Record<string, unknown[]> = {}
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/entitlement-db', () => ({ getEntitlementFor: () => entitlement() }))
vi.mock('@/app/studio/actions', () => ({ signOut: vi.fn() }))
vi.mock('@/components/FeedbackBar', () => ({ FeedbackBar: (p: { jobId: string; rerollsLeft: number }) => <div data-bar={p.jobId}>bar {p.rerollsLeft}</div> }))
vi.mock('@/components/CoverPlayer', () => ({ CoverPlayer: (p: { jobId: string }) => <div data-player={p.jobId} /> }))
vi.mock('@/components/LyricsEditor', () => ({ LyricsEditor: () => null }))
vi.mock('@/components/StudioAutoRefresh', () => ({ StudioAutoRefresh: () => null }))
vi.mock('@/components/Scorecard', () => ({ Scorecard: () => null }))
vi.mock('@/lib/supabase-server', () => ({
  currentUser: async () => ({ id: 'user-1', email: 'a@b.example' }),
  supabaseServer: async () => ({
    from: (t: string) => {
      const c = { select: () => c, order: () => c, limit: () => c, then: (r: (v: unknown) => void) => r({ data: tables[t] ?? [], error: null }) }
      return c
    },
  }),
}))
const { default: Studio } = await import('@/app/studio/page')

const job = (o: Record<string, unknown>) => ({
  id: 'j1', title: 'A Song', primary_artist: 'An Artist', source_language: 'EN', target_language: 'ES',
  status: 'delivered', created_at: '2026-09-22T00:00:00Z', lyrics: null, parent_job_id: null,
  reroll_index: 0, licence_terms_version: '2026-09-22', ...o,
})
const render = async () => renderToStaticMarkup(await Studio({ searchParams: Promise.resolve({}) }))

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k]
  entitlement.mockResolvedValue({ ok: true, source: 'subscription', plan: 'fan', tracksLeft: 3, renewsAt: '2026-10-01T00:00:00Z' })
})

describe('studio home', () => {
  it('shows the plan card with tracks left and the billing link, or the empty state with the deck copy', async () => {
    let h = await render()
    expect(h).toContain('Fan'); expect(h).toContain('3 tracks left'); expect(h).toContain('href="/studio/billing"')
    entitlement.mockResolvedValue({ ok: false, reason: 'no_plan' })
    h = await render()
    expect(h).toContain('No plan yet')
    expect(h).toContain('Nothing here yet. Pick a plan and make your first track.')
    expect(h).toContain('href="/pricing"')
  })
  it('nests re-rolls under their original as Take 2, each with a player, a bar and the licence line', async () => {
    tables.song_jobs = [job({}), job({ id: 'j2', parent_job_id: 'j1', reroll_index: 1 })]
    const h = await render()
    expect(h).toContain('Take 2')
    expect(h).toContain('data-player="j1"'); expect(h).toContain('data-player="j2"')
    expect(h).toContain('data-bar="j1"'); expect(h).toContain('bar 1')
    expect(h).toContain('Personal use only. Not for release or sale.')
  })
  it('shows the closed-window copy on a rejected child and reads the heartbeat', async () => {
    tables.song_jobs = [job({}), job({ id: 'j2', parent_job_id: 'j1', reroll_index: 1, status: 'rejected' })]
    tables.worker_heartbeat = [{ worker: 'optiplex', seen_at: new Date().toISOString() }]
    const h = await render()
    expect(h).toContain('The re-roll window for this song has closed.')
    expect(h).toContain('Renders are running')
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Rewrite `app/studio/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { JobStatus } from '@/components/JobStatus'
import { LyricsEditor } from '@/components/LyricsEditor'
import { Scorecard } from '@/components/Scorecard'
import { CoverPlayer } from '@/components/CoverPlayer'
import { FeedbackBar, type ExistingFeedback } from '@/components/FeedbackBar'
import { StudioAutoRefresh } from '@/components/StudioAutoRefresh'
import { rerollsLeft } from '@/lib/entitlement'
import { getEntitlementFor } from '@/lib/entitlement-db'
import { planById } from '@/lib/plans'
import { currentUser, supabaseServer } from '@/lib/supabase-server'
import { signOut } from './actions'

/**
 * The Door-2 studio: plan card, then the songs, re-rolls nested under their original.
 * Every read is the USER's client: RLS decides the rows, the column grant decides the columns,
 * so the select lists are explicit and never `*`. A child's `pipeline_error` is service-role
 * only; the closed-window copy keys off `status='rejected'` on a child instead.
 */
export const metadata = { title: 'The studio', robots: { index: false, follow: false } }

type Job = {
  id: string; title: string; primary_artist: string; source_language: string; target_language: string
  status: string; created_at: string; lyrics: string | null; parent_job_id: string | null
  reroll_index: number; licence_terms_version: string | null
}
type Feedback = { job_id: string; rating: 'up' | 'down'; note: string | null; tags: string[] }

const LICENCE_LINE = 'Personal use only. Not for release or sale. lyrical may carry an inaudible provenance mark.'
const REROLL_CLOSED = 'The re-roll window for this song has closed. Make it again to start fresh.'
const OUT_OF_TRACKS = 'You are out of tracks for this period. Upgrade, buy a Single, or wait for it to renew.'
const EMPTY = 'Nothing here yet. Pick a plan and make your first track.'
const HEARTBEAT_STALE_MS = 10 * 60 * 1000
const cta = 'nudge inline-flex items-center gap-1.5 rounded-card bg-ember px-6 py-3 text-cream'
const link = 'text-sm text-indigo underline underline-offset-4'

export default async function Studio({ searchParams }: { searchParams: Promise<{ submitted?: string; paid?: string }> }) {
  const [user, params] = await Promise.all([currentUser(), searchParams])
  if (!user) redirect('/studio/sign-in?next=/studio')

  const supabase = await supabaseServer()
  const [{ data: jobRows }, { data: feedbackRows }, { data: beat }, entitlement] = await Promise.all([
    supabase.from('song_jobs')
      .select('id, title, primary_artist, source_language, target_language, status, created_at, lyrics, parent_job_id, reroll_index, licence_terms_version')
      .order('created_at', { ascending: false }),
    supabase.from('job_feedback').select('job_id, rating, note, tags'),
    supabase.from('worker_heartbeat').select('worker, seen_at').order('seen_at', { ascending: false }).limit(1),
    getEntitlementFor(user.id),
  ])
  const jobs = (jobRows ?? []) as Job[]
  const feedback = new Map(((feedbackRows ?? []) as Feedback[]).map((f) => [f.job_id, f]))
  const originals = jobs.filter((j) => j.reroll_index === 0)
  const childrenOf = (id: string) => jobs.filter((j) => j.parent_job_id === id).sort((a, b) => a.reroll_index - b.reroll_index)
  const seen = beat?.[0]?.seen_at ? Date.parse(beat[0].seen_at as string) : 0
  const rendering = seen > 0 && Date.now() - seen < HEARTBEAT_STALE_MS
  const existing = (id: string): ExistingFeedback => {
    const f = feedback.get(id)
    return f ? { rating: f.rating, note: f.note, tags: f.tags ?? [] } : null
  }
  const plan = entitlement.ok ? planById(entitlement.plan) : null

  const take = (j: Job, left: number, n?: number) => (
    <div key={j.id} className={n ? 'mt-4 rounded-card border border-graphite/12 bg-cream/60 p-5' : ''}>
      {n ? <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">Take {n}</span> : null}
      <div className="mt-2"><JobStatus status={j.status} /></div>
      {j.status === 'delivered' && (
        <>
          <CoverPlayer jobId={j.id} />
          <p className="mt-3 text-xs leading-relaxed text-graphite/55">{LICENCE_LINE}</p>
          <FeedbackBar jobId={j.id} existing={existing(j.id)} rerollsLeft={left} canReroll />
        </>
      )}
      {n && j.status === 'rejected' ? <p className="mt-3 text-sm text-graphite/70">{REROLL_CLOSED}</p> : null}
    </div>
  )

  return (
    <section className="mx-auto max-w-3xl px-6 py-24 sm:py-28">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">The studio</span>
          <h1 className="mt-5 font-brand text-4xl leading-[1.1] tracking-tight text-balance">Your songs.</h1>
        </div>
        <form action={signOut}>
          <button type="submit" className="nudge inline-flex min-h-11 items-center text-sm text-graphite/60 underline underline-offset-4">Sign out</button>
        </form>
      </div>
      <p className="mt-4 text-sm text-graphite/55">Signed in as {user.email}</p>

      {/* The plan card. Billing lives at /studio/billing (Bot A); this is the only link to it. */}
      <div className="mt-8 rounded-card border border-graphite/15 p-6">
        {entitlement.ok ? (
          <>
            <span className="font-brand text-xl tracking-tight">{plan?.name ?? 'Single'}</span>
            <p className="mt-1 text-sm text-graphite/70">
              {entitlement.tracksLeft} {entitlement.tracksLeft === 1 ? 'track' : 'tracks'} left
              {entitlement.renewsAt ? ` \u00b7 renews ${new Date(entitlement.renewsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}` : ''}
            </p>
            <a href="/studio/billing" className={`mt-3 inline-block ${link}`}>Manage plan</a>
          </>
        ) : (
          <>
            <span className="font-brand text-xl tracking-tight">No plan yet</span>
            <p className="mt-1 text-sm text-graphite/70">{entitlement.reason === 'period_exhausted' ? OUT_OF_TRACKS : EMPTY}</p>
            <a href="/pricing" className={`mt-4 ${cta}`}>See plans<span className="shift-arrow">&rarr;</span></a>
          </>
        )}
        <p className="mt-4 text-xs text-graphite/50">
          {rendering ? 'Renders are running.' : 'Renders are paused, your song will start when they resume.'}
        </p>
      </div>

      {(params.submitted || params.paid) && (
        <p role="status" className="mt-8 rounded-card border-l-[3px] border-indigo bg-indigo/5 px-5 py-4 leading-relaxed">
          {params.paid ? 'Paid. Your plan is live.' : 'That is with us and we are making it now. It will appear below the moment it is ready.'}
        </p>
      )}
      {entitlement.ok && (
        <a href="/studio/new" className={`mt-8 flex w-fit px-7 py-4 ${cta}`}>
          {originals.length ? 'Make another track' : 'Make your first track'}<span className="shift-arrow">&rarr;</span>
        </a>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <a href="/studio/voices/new" className="nudge inline-flex min-h-11 items-center rounded-card border border-graphite/25 px-5 text-sm hover:border-indigo hover:text-indigo">Build a voice model</a>
        <a href="/studio/voices" className={`nudge inline-flex min-h-11 items-center ${link}`}>Voice models</a>
      </div>

      {originals.length > 0 && (
        <ul className="mt-12 flex flex-col gap-5">
          <StudioAutoRefresh active={jobs.some((j) => j.status !== 'delivered' && j.status !== 'rejected')} />
          {originals.map((j) => {
            const kids = childrenOf(j.id)
            const left = rerollsLeft(kids.length)
            return (
              <li key={j.id} className="rounded-card border border-graphite/15 p-6">
                <span className="font-brand text-xl tracking-tight">{j.title}</span>
                <p className="mt-1 text-sm text-graphite/60">{j.primary_artist} &middot; {j.source_language} to {j.target_language}</p>
                <div className="mt-4">{take(j, left)}</div>
                {kids.map((k) => take(k, left, k.reroll_index + 1))}
                <LyricsEditor jobId={j.id} initial={j.lyrics ?? ''} locked={j.status !== 'submitted'} />
              </li>
            )
          })}
        </ul>
      )}
      <Scorecard />
    </section>
  )
}
```

- [ ] **Step 4: Run, expect PASS.** Then `npm run build`. Commit: `git add app/studio/page.tsx tests/feedback-studio-home.test.tsx && git commit -m "feat(studio): plan card, nested takes, feedback bars"`

### Task 9: Sign-in copy

**Files:** modify `app/studio/sign-in/page.tsx`

- [ ] **Step 1:** Replace the `<h1>` text and add the sub line under it:

```tsx
      <h1 className="mt-5 font-brand text-4xl leading-[1.1] tracking-tight text-balance">
        Sing your favorite song in any language.
      </h1>
      <p className="mt-4 leading-relaxed text-graphite/75">
        Founding beta: rough edges, honest prices, two free re-rolls on every track. Sign in with your email to start.
      </p>
```

- [ ] **Step 2:** `npx vitest run tests/copy.test.ts` (the banned-phrase test stays green). Commit: `git commit -am "copy(studio): beta framing on sign-in"`

### Task 10: `/queue` Feedback tab and CSV

**Files:** create `app/queue/FeedbackTab.tsx`, `tests/feedback-queue-tab.test.tsx`; modify `app/queue/page.tsx`, `app/queue/export/route.ts`

**Interfaces:** `FeedbackTab()` (async server component, admin client); `FEEDBACK_SELECT`, `FEEDBACK_COLUMNS`, `flattenFeedback(rows)` shared by the tab and the export route.

- [ ] **Step 1: Failing tests**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const rows = vi.fn()
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ from: () => { const c = { select: () => c, order: () => c, limit: () => rows() }; return c } }),
}))
const { FeedbackTab, FEEDBACK_COLUMNS, flattenFeedback } = await import('@/app/queue/FeedbackTab')
const ROW = {
  id: 'f1', created_at: '2026-09-22T01:00:00Z', job_id: 'j1', rating: 'down', tags: ['timing'], note: 'Chorus line 2 lands late',
  song_jobs: { title: 'A Song', primary_artist: 'An Artist', source_language: 'EN', target_language: 'ES', reroll_index: 0 },
}
beforeEach(() => rows.mockResolvedValue({ data: [ROW], error: null }))

describe('Feedback tab', () => {
  it('draws the job, the rating, the tags, the note and a link to the job', async () => {
    const h = renderToStaticMarkup(await FeedbackTab())
    for (const s of ['A Song', 'An Artist', 'EN to ES', 'Thumbs down', 'timing', 'Chorus line 2 lands late', 'href="/queue?tab=songs&amp;show=all#j1"']) expect(h).toContain(s)
  })
  it('flattens the join for the CSV without user ids', () => {
    expect(flattenFeedback([ROW])[0]).toMatchObject({ title: 'A Song', primary_artist: 'An Artist', rating: 'down', tags: ['timing'], reroll_index: 0, job_id: 'j1' })
    expect(FEEDBACK_COLUMNS[0]).toBe('created_at')
    expect(FEEDBACK_COLUMNS).not.toContain('user_id')
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: `app/queue/FeedbackTab.tsx`**

```tsx
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Every rating, newest first. Staff path: the admin client, like the other tabs. The join to
 * song_jobs is a PostgREST embed over the job_id foreign key. No emails and no user ids in the
 * markup or the CSV: the note is the data, the job link is how you find the person.
 */
export type FeedbackRow = {
  id: string; created_at: string; job_id: string; rating: 'up' | 'down'; tags: string[]; note: string | null
  song_jobs: { title: string; primary_artist: string; source_language: string; target_language: string; reroll_index: number } | null
}
export const FEEDBACK_SELECT =
  'id, created_at, job_id, rating, tags, note, song_jobs(title, primary_artist, source_language, target_language, reroll_index)'
export const FEEDBACK_COLUMNS = ['created_at', 'title', 'primary_artist', 'source_language', 'target_language', 'reroll_index', 'rating', 'tags', 'note', 'job_id']
const PAGE_SIZE = 500
const mono = 'font-mono text-[11px] uppercase tracking-[0.16em]'

export function flattenFeedback(rows: FeedbackRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    created_at: r.created_at,
    title: r.song_jobs?.title ?? '',
    primary_artist: r.song_jobs?.primary_artist ?? '',
    source_language: r.song_jobs?.source_language ?? '',
    target_language: r.song_jobs?.target_language ?? '',
    reroll_index: r.song_jobs?.reroll_index ?? 0,
    rating: r.rating,
    tags: r.tags,
    note: r.note,
    job_id: r.job_id,
  }))
}

export async function FeedbackTab() {
  const { data, error } = await supabaseAdmin()
    .from('job_feedback').select(FEEDBACK_SELECT).order('created_at', { ascending: false }).limit(PAGE_SIZE)
  if (error) {
    return <p className="mt-12 max-w-xl text-graphite/70">The feedback table cannot be read. Apply migration 002 and reload. <span className="mt-3 block font-mono text-xs text-graphite/50">{error.message}</span></p>
  }
  const rows = (data ?? []) as unknown as FeedbackRow[]
  if (rows.length === 0) return <p className="mt-12 text-graphite/60">No ratings yet.</p>
  return (
    <ol className="mt-2">
      {rows.map((r) => (
        <li key={r.id} className="border-b border-graphite/12 py-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-brand text-2xl tracking-tight">{r.song_jobs?.title ?? 'Unknown song'}</h3>
            <span className="text-sm text-graphite/60">
              {r.song_jobs?.primary_artist} &middot; {r.song_jobs?.source_language} to {r.song_jobs?.target_language}
              {r.song_jobs?.reroll_index ? ` \u00b7 Take ${r.song_jobs.reroll_index + 1}` : ''}
            </span>
            <span className={`${mono} ${r.rating === 'down' ? 'text-ember' : 'text-indigo'}`}>{r.rating === 'down' ? 'Thumbs down' : 'Thumbs up'}</span>
            <time dateTime={r.created_at} className="ml-auto font-mono text-[11px] tabular-nums text-graphite/45">
              {new Date(r.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </time>
          </div>
          {r.tags.length > 0 && <p className={`mt-2 ${mono} text-graphite/50`}>{r.tags.join(' \u00b7 ')}</p>}
          {r.note && <p className="mt-4 max-w-2xl whitespace-pre-line leading-relaxed text-graphite/80">{r.note}</p>}
          <a href={`/queue?tab=songs&show=all#${r.job_id}`} className="mt-3 inline-block text-sm text-indigo underline underline-offset-4">Open the job</a>
        </li>
      ))}
    </ol>
  )
}
```

- [ ] **Step 4: `app/queue/page.tsx`**

`type Tab = 'songs' | 'voices' | 'enquiries' | 'feedback'`. Import `{ FeedbackTab } from './FeedbackTab'`. Tab resolution:

```ts
  const tab: Tab =
    params.tab === 'enquiries' ? 'enquiries' : params.tab === 'voices' ? 'voices' : params.tab === 'feedback' ? 'feedback' : 'songs'
```

A fourth `<a>` after Enquiries in the nav, same classes, label `Feedback`, `href={tabHref('feedback')}`. In the render switch add `: tab === 'feedback' ? (<FeedbackTab />)` before the Enquiries branch. The To handle / Everything links stay and do nothing on this tab.

- [ ] **Step 5: `app/queue/export/route.ts`**

Import `{ FEEDBACK_COLUMNS, FEEDBACK_SELECT, flattenFeedback, type FeedbackRow } from '@/app/queue/FeedbackTab'`. Move the existing `const tab = ...` line up to directly after the session check and add under it:

```ts
  if (tab === 'feedback') {
    const { data, error } = await supabaseAdmin().from('job_feedback').select(FEEDBACK_SELECT).order('created_at', { ascending: false })
    if (error) return new Response(`Could not read job_feedback: ${error.message}`, { status: 500 })
    return new Response(toCsv(FEEDBACK_COLUMNS, flattenFeedback((data ?? []) as unknown as FeedbackRow[])), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="lyrical-feedback-${new Date().toISOString().slice(0, 10)}.csv"`,
        'cache-control': 'no-store, private',
      },
    })
  }
```

- [ ] **Step 6: Run, expect PASS** (`tests/queue-songs-tab.test.tsx` still green). Commit: `git add app/queue tests/feedback-queue-tab.test.tsx && git commit -m "feat(queue): Feedback tab + CSV export"`

### Task 11: Verify on omega, rebase, PR

- [ ] **Step 1: Local gate** `npm test && npm run build`. Both green or nothing ships.

- [ ] **Step 2: Rebase after Bot A merges** `git fetch && git rebase origin/develop`. Expected conflicts: `app/studio/self-serve-actions.ts` (keep Bot A's entitlement block, keep your `SelfServeJobSchema` parse, `licence_terms_version` stamp and profile stamp) and `lib/entitlement-db.ts` if you created the temporary copy (`git checkout --theirs lib/entitlement-db.ts`). Re-run the gate.

- [ ] **Step 3: Push and PR** `git push -u origin feat/v2-studio`. PR into `develop` titled "v2 studio: feedback, re-rolls, licence gate, plan card, staff feedback tab". Body: the task list, the Bot F note (a `stems_expired` child must also get `status='rejected'`; the studio keys the closed-window copy off it), the rebase note, and the omega evidence from Step 4.

- [ ] **Step 4: The studio flow on omega** (the branch's Vercel preview, or `develop` after merge). Test account signed in through Henry's Chrome (claude-in-chrome tools; never type credentials). Walk: `/studio` shows the plan card → `/studio/new` shows the licence box and refuses submit unticked → submit a song → the OptiPlex delivers → thumbs up saves → thumbs down with a short note is refused, with 20+ characters saves → "Re-roll this track (2 left)" → click → in the Supabase table editor (Henry's Chrome) a new `song_jobs` row exists with `parent_job_id` = the original, `reroll_index` 1, `pipeline_state` queued, `seed` set, no `song_job_assets` → the studio shows "Take 2" with its status rail → `/queue?tab=feedback` lists the rating → `/queue/export?tab=feedback` downloads. Paste the child row's id into the PR body.

## Done when

- `npm test && npm run build` green on the rebased branch.
- `tests/feedback-*.test.ts(x)` all pass: licence terms, schema, actions, reroll rules, bar, licence form, studio home, queue tab.
- On omega: a rated, re-rolled track produces a queued child row in Supabase and a "Take 2" card in the studio.
- `/queue?tab=feedback` and its CSV work behind the existing admin gate.
- PR open into `develop`, rebased on Bot A, with the Bot F note in the body.
