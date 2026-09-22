import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * `/admin`'s own gate. Every tab's content is proven by its own test file (admin-songs-tab,
 * admin-feedback-tab, etc); this one proves the page itself refuses to render any of it without
 * a session, the same way `/queue`'s page did before the move.
 */

const hasAdminSession = vi.fn()
vi.mock('@/lib/admin-session', () => ({
  hasAdminSession: () => hasAdminSession(),
}))

// The tab components each read Supabase on import-time module evaluation paths; stub every one
// so this test exercises only the gate, not tab content.
vi.mock('@/app/admin/SongsTab', () => ({ SongsTab: () => null }))
vi.mock('@/app/admin/VoicesTab', () => ({ VoicesTab: () => null }))
vi.mock('@/app/admin/EnquiriesTab', () => ({ EnquiriesTab: () => null }))
vi.mock('@/app/admin/FeedbackTab', () => ({ FeedbackTab: () => null }))
vi.mock('@/app/admin/PeopleTab', () => ({ PeopleTab: () => null }))
vi.mock('@/app/admin/actions', () => ({ login: vi.fn(), logout: vi.fn() }))

const { default: AdminPage } = await import('@/app/admin/page')

async function render(params: Record<string, string> = {}) {
  const element = await AdminPage({ searchParams: Promise.resolve(params) })
  return renderToStaticMarkup(element)
}

describe('the gate', () => {
  it('shows the login form and no tab data when there is no session', async () => {
    hasAdminSession.mockResolvedValue(false)
    const html = await render({ tab: 'work' })
    expect(html).toContain('Password')
    expect(html).toContain('Open')
    // The tab bar itself is never drawn before sign-in. (The login copy names the six areas in
    // a sentence, so this checks for the nav rather than for the words themselves.)
    expect(html).not.toContain('aria-label="Admin sections"')
    expect(html).not.toContain('Sign out')
  })

  it('shows a wrong-password message when told to', async () => {
    hasAdminSession.mockResolvedValue(false)
    const html = await render({ error: '1' })
    expect(html).toContain('not right')
  })

  it('draws all six tabs once signed in', async () => {
    hasAdminSession.mockResolvedValue(true)
    const html = await render({})
    for (const label of ['People', 'Money', 'Work', 'Voice', 'Relationships', 'Issues']) {
      expect(html).toContain(label)
    }
  })
})
