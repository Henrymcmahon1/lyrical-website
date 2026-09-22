import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * `SignInForm`, actually rendered. Only the initial (email) step is checkable this way, the same
 * limitation every static-markup component test in this repo has: there is no DOM to dispatch
 * events into. The state machine itself (email step -> code step -> verify) is covered by
 * `tests/v3-auth-sign-in-code.test.ts` against the server actions it calls.
 */
vi.mock('@/app/(public)/studio/sign-in/actions', () => ({
  requestSignInCode: vi.fn(),
  verifySignInCode: vi.fn(),
}))
vi.mock('@/lib/supabase-client', () => ({ supabaseBrowser: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

const { SignInForm } = await import('@/components/SignInForm')

const html = (next?: string) => renderToStaticMarkup(<SignInForm next={next} />)

describe('SignInForm, initial render', () => {
  it('is a real form with an email field', () => {
    const h = html()
    expect(h).toMatch(/<form/)
    expect(h).toContain('type="email"')
  })

  it('offers Continue with Google', () => {
    expect(html()).toContain('Continue with Google')
  })

  it('says there is no password to remember', () => {
    expect(html()).toMatch(/no password/i)
  })

  it('never uses an em dash', () => {
    expect(html()).not.toContain('—')
  })
})
