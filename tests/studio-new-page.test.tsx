import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PLANS } from '@/lib/plans'

/**
 * `/studio/new` (Create), rendered. The entitlement gate that redirects a customer with no plan
 * to /pricing is unchanged and pre-existing; this test is about the new PlanCard shown above the
 * submit form for an entitled customer, so it is unmissable how many tracks they have left
 * before they spend one.
 */
const currentUser = vi.fn()
const entitlement = vi.fn()

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock('@/lib/supabase-server', () => ({
  currentUser: () => currentUser(),
  supabaseServer: async () => ({
    from: () => {
      const c = { select: () => c, order: () => c, then: (r: (v: unknown) => void) => r({ data: [], error: null }) }
      return c
    },
  }),
}))
vi.mock('@/lib/entitlement-db', () => ({ getEntitlementFor: () => entitlement() }))
vi.mock('@/components/SongSubmitForm', () => ({ SongSubmitForm: () => <div data-form="song-submit" /> }))

const { default: NewSong } = await import('@/app/studio/new/page')

beforeEach(() => {
  vi.clearAllMocks()
  currentUser.mockResolvedValue({ id: 'user-1', email: 'a@b.example' })
  entitlement.mockResolvedValue({ ok: true, source: 'subscription', plan: 'fan', tracksLeft: 4, renewsAt: '2026-10-01T00:00:00Z' })
})

describe('/studio/new', () => {
  it('redirects to sign-in when nobody is signed in', async () => {
    currentUser.mockResolvedValueOnce(null)
    await expect(NewSong()).rejects.toThrow('REDIRECT:/studio/sign-in?next=/studio/new')
  })

  it('redirects to pricing when the customer has no plan', async () => {
    entitlement.mockResolvedValue({ ok: false, reason: 'no_plan' })
    await expect(NewSong()).rejects.toThrow('REDIRECT:/pricing?why=plan')
  })

  it('shows a prominent plan card with tracks left, the plan name and the renewal date, above the form', async () => {
    const html = renderToStaticMarkup(await NewSong())
    expect(html).toContain('4 tracks left')
    expect(html).toContain(PLANS.fan.name)
    expect(html).toContain('Oct 1')
    expect(html).toContain('href="/studio/billing"')
    const planIndex = html.indexOf('4 tracks left')
    const formIndex = html.indexOf('data-form="song-submit"')
    expect(planIndex).toBeGreaterThan(-1)
    expect(formIndex).toBeGreaterThan(planIndex)
  })
})
