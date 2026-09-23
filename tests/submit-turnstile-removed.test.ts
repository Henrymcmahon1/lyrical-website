import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * Turnstile removed from the POST-SIGN-IN song submit, 2026-09-23, Henry's call: sign-in and
 * the artist EOI are the unauthenticated, bot-exposed surfaces and keep the challenge. Submit
 * only runs for a signed-in customer with an entitlement check and existing rate limits, which
 * is judged gate enough on its own now that a session is already required to reach it.
 *
 * `verifyTurnstile` is mocked here to prove it is never even called, not just that it is
 * configured to pass: a call would mean the removal was incomplete.
 */
const verifyTurnstile = vi.fn(async () => ({ ok: true }))
vi.mock('@/lib/turnstile', () => ({
  verifyTurnstile: (...a: unknown[]) => verifyTurnstile(...a),
  turnstileSiteKey: () => 'site-key-configured',
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

const getEntitlementFor = vi.fn()
vi.mock('@/lib/entitlement-db', () => ({ getEntitlementFor: (...a: unknown[]) => getEntitlementFor(...a) }))
const consumeCredit = vi.fn()
vi.mock('@/lib/credits', () => ({ consumeCredit: (...a: unknown[]) => consumeCredit(...a) }))
vi.mock('@/lib/supabase-server', () => ({
  currentUser: async () => ({ id: 'u1', email: 'fan@example.com' }),
  supabaseServer: async () => ({
    from: () => ({
      insert: () => ({ error: null }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    }),
  }),
}))
const insert = vi.fn().mockResolvedValue({ error: null })
const delEq = vi.fn().mockResolvedValue({ error: null })
const del = vi.fn(() => ({ eq: delEq }))
const updateIs = vi.fn().mockResolvedValue({ error: null })
const update = vi.fn(() => ({ eq: () => ({ is: updateIs }) }))
const admin = { from: () => ({ insert, delete: del, update }) }
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: () => admin }))
vi.mock('@/lib/mailer', () => ({ mailCustomer: vi.fn(), mailFounders: vi.fn() }))

const { submitSelfServeJob } = await import('@/app/studio/self-serve-actions')
const { submitSongJob } = await import('@/app/studio/submit-actions')
const { SongSubmitForm } = await import('@/components/SongSubmitForm')

const jobId = '11111111-1111-4111-8111-111111111111'
const raw = {
  jobId,
  title: 'Song',
  primaryArtist: 'Artist',
  sourceLanguage: 'EN',
  targetLanguage: 'ES',
  rightsWarranty: true,
  licenceAccepted: true,
  lyrics: 'Ella es callaita',
  assets: [
    { kind: 'instrumental', path: `u1/${jobId}/inst.wav`, filename: 'inst.wav', bytes: 10 },
    { kind: 'vocal', path: `u1/${jobId}/vox.wav`, filename: 'vox.wav', bytes: 10 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  insert.mockResolvedValue({ error: null })
  getEntitlementFor.mockResolvedValue({ ok: true, source: 'subscription', plan: 'fan', tracksLeft: 3, renewsAt: null })
})

describe('submit no longer checks Turnstile', () => {
  it('submitSelfServeJob never calls verifyTurnstile, and succeeds with no turnstileToken', async () => {
    const result = await submitSelfServeJob(raw)
    expect(result).toEqual({ ok: true, jobId })
    expect(verifyTurnstile).not.toHaveBeenCalled()
  })

  it('submitSongJob (the manual funnel) never calls verifyTurnstile either', async () => {
    await submitSongJob(raw)
    expect(verifyTurnstile).not.toHaveBeenCalled()
  })

  it('the submit form renders no Turnstile widget, in either mode', () => {
    // The widget's SSR shell has no distinguishing text, only its own `min-h-[65px]` class, so
    // that class (rather than the word "turnstile") is what proves it is gone from the markup.
    for (const selfServe of [true, false]) {
      const html = renderToStaticMarkup(createElement(SongSubmitForm, { selfServe }))
      expect(html).not.toContain('min-h-[65px]')
    }
  })

  it('the submit form source no longer imports the Turnstile widget or site key', () => {
    const src = readFileSync('components/SongSubmitForm.tsx', 'utf8')
    expect(src).not.toMatch(/from '@\/components\/Turnstile'/)
    expect(src).not.toMatch(/turnstileSiteKey/)
    expect(src).not.toMatch(/turnstileToken/)
  })

  it('the two server actions no longer import verifyTurnstile', () => {
    for (const f of ['app/studio/self-serve-actions.ts', 'app/studio/submit-actions.ts']) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} still imports verifyTurnstile`).not.toMatch(/verifyTurnstile/)
    }
  })
})
