import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ADMIN_OK, BREAK_GLASS_OK, MFA_REQUIRED, NOT_ALLOWLISTED, NO_SESSION } from './admin-gate-fixtures'

/**
 * `/admin`'s own gate. Every tab's content is proven by its own test file (admin-songs-tab,
 * admin-feedback-tab, etc); this one proves the page itself refuses to render any of it without
 * an admin, and sends a signed-out visitor to `/admin/sign-in` unless break-glass is on.
 */

const requireAdmin = vi.fn()
vi.mock('@/lib/admin-session', () => ({
  requireAdmin: () => requireAdmin(),
}))

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

// Tab components render a marker, so a refused render can be proven to contain no tab at all.
vi.mock('@/app/admin/SongsTab', () => ({ SongsTab: () => 'TAB-DATA' }))
vi.mock('@/app/admin/VoicesTab', () => ({ VoicesTab: () => 'TAB-DATA' }))
vi.mock('@/app/admin/EnquiriesTab', () => ({ EnquiriesTab: () => 'TAB-DATA' }))
vi.mock('@/app/admin/FeedbackTab', () => ({ FeedbackTab: () => 'TAB-DATA' }))
vi.mock('@/app/admin/PeopleTab', () => ({ PeopleTab: () => 'TAB-DATA' }))
vi.mock('@/app/admin/MoneyTab', () => ({ MoneyTab: () => 'TAB-DATA' }))
vi.mock('@/app/admin/IssuesTab', () => ({ IssuesTab: () => 'TAB-DATA' }))
vi.mock('@/app/admin/actions', () => ({ login: vi.fn(), logout: vi.fn() }))

const { default: AdminPage } = await import('@/app/admin/page')

async function render(params: Record<string, string> = {}) {
  const element = await AdminPage({ searchParams: Promise.resolve(params) })
  return renderToStaticMarkup(element)
}

function breakGlassOn() {
  process.env.ADMIN_BREAK_GLASS = 'on'
  process.env.ADMIN_PASSWORD = 'correct horse battery staple'
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  delete process.env.ADMIN_BREAK_GLASS
  delete process.env.ADMIN_PASSWORD
})

describe('signed out', () => {
  it('redirects to /admin/sign-in when break-glass is off (the default)', async () => {
    requireAdmin.mockResolvedValue(NO_SESSION)
    await expect(render({ tab: 'work' })).rejects.toThrow('REDIRECT:/admin/sign-in')
  })

  it('never draws the password form while break-glass is off, even with ADMIN_PASSWORD set', async () => {
    process.env.ADMIN_PASSWORD = 'correct horse battery staple'
    requireAdmin.mockResolvedValue(NO_SESSION)
    await expect(render()).rejects.toThrow('REDIRECT:/admin/sign-in')
  })

  it('shows the break-glass password form, and no tab data, when break-glass is on', async () => {
    breakGlassOn()
    requireAdmin.mockResolvedValue(NO_SESSION)
    const html = await render({ tab: 'work' })
    expect(html).toContain('type="password"')
    expect(html).toContain('/admin/sign-in')
    expect(html).not.toContain('TAB-DATA')
    expect(html).not.toContain('aria-label="Admin sections"')
    expect(html).not.toContain('Sign out')
  })

  it('shows a wrong-password message when told to (break-glass on)', async () => {
    breakGlassOn()
    requireAdmin.mockResolvedValue(NO_SESSION)
    const html = await render({ error: '1' })
    expect(html).toContain('not right')
  })
})

describe('signed in but not an admin', () => {
  it('shows a plain Not authorized page with no CRM data and no sign-out', async () => {
    requireAdmin.mockResolvedValue(NOT_ALLOWLISTED)
    const html = await render({ tab: 'people' })
    expect(html).toContain('Not authorized')
    expect(html).not.toContain('TAB-DATA')
    expect(html).not.toContain('aria-label="Admin sections"')
    // Their customer session is left alone: nothing here signs them out.
    expect(html).not.toContain('Sign out')
    expect(html).not.toContain('type="password"')
  })

  it('asks for two-step verification when the session is short of AAL2', async () => {
    requireAdmin.mockResolvedValue(MFA_REQUIRED)
    const html = await render({ tab: 'people' })
    expect(html).toContain('Two-step verification')
    expect(html).not.toContain('TAB-DATA')
    expect(html).not.toContain('aria-label="Admin sections"')
  })
})

describe('signed in as an admin', () => {
  it('draws all six tabs and the tab content', async () => {
    requireAdmin.mockResolvedValue(ADMIN_OK)
    const html = await render({})
    for (const label of ['People', 'Money', 'Work', 'Voice', 'Relationships', 'Issues']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('TAB-DATA')
    expect(html).toContain('Sign out')
  })

  it('names who is signed in', async () => {
    requireAdmin.mockResolvedValue(ADMIN_OK)
    expect(await render({})).toContain('info@lyricalglobal.com')
  })

  it('flags a break-glass session on the page itself', async () => {
    breakGlassOn()
    requireAdmin.mockResolvedValue(BREAK_GLASS_OK)
    const html = await render({})
    expect(html).toContain('Break-glass')
    expect(html).toContain('TAB-DATA')
  })
})

describe('Door 1 link', () => {
  it('the console nav links to /admin/door1 for an admin', async () => {
    requireAdmin.mockResolvedValue(ADMIN_OK)
    expect(await render()).toContain('href="/admin/door1"')
  })
})
