import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ADMIN_OK, MFA_REQUIRED, NOT_ALLOWLISTED, NO_SESSION } from './admin-gate-fixtures'

/**
 * `/admin/sign-in`: the studio's own 6-digit email-code form (the SAME component and the SAME
 * server actions, no forked OTP logic), sent on to `/admin` after verify.
 */

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

// The real form is a client component; stand it in with one that prints the props it was given.
vi.mock('@/components/SignInForm', () => ({
  SignInForm: (props: Record<string, unknown>) => `SIGN-IN-FORM ${JSON.stringify(props)}`,
}))

const mod = await import('@/app/admin/sign-in/page')
const Page = mod.default

async function render() {
  return renderToStaticMarkup(await Page())
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/admin/sign-in', () => {
  it('draws the shared email-code form, sending the admin on to /admin, without Google', async () => {
    requireAdmin.mockResolvedValue(NO_SESSION)
    const html = await render()
    expect(html).toContain('SIGN-IN-FORM')
    expect(html).toContain('&quot;next&quot;:&quot;/admin&quot;')
    expect(html).toContain('&quot;google&quot;:false')
  })

  it('sends an admin who is already signed in straight to /admin', async () => {
    requireAdmin.mockResolvedValue(ADMIN_OK)
    await expect(render()).rejects.toThrow('REDIRECT:/admin')
  })

  it('tells a signed-in customer they are not authorized, and draws no form', async () => {
    requireAdmin.mockResolvedValue(NOT_ALLOWLISTED)
    const html = await render()
    expect(html).toContain('Not authorized')
    expect(html).not.toContain('SIGN-IN-FORM')
    expect(html).not.toContain('Sign out')
  })

  it('asks for two-step verification when the session is short of AAL2', async () => {
    requireAdmin.mockResolvedValue(MFA_REQUIRED)
    const html = await render()
    expect(html).toContain('Two-step verification')
    expect(html).not.toContain('SIGN-IN-FORM')
  })

  it('is noindex', () => {
    expect(mod.metadata.robots).toMatchObject({ index: false, follow: false })
  })

  it('never uses an em dash', async () => {
    requireAdmin.mockResolvedValue(NO_SESSION)
    expect(await render()).not.toContain(String.fromCharCode(0x2014))
  })
})
