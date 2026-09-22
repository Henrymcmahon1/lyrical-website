import { describe, expect, it, vi } from 'vitest'

/**
 * `/queue` is now a redirect to `/admin`, the same way `/leads` redirects to `/queue`'s
 * successor. Old tab names are mapped onto the new six-tab names so a bookmarked
 * `/queue?tab=voices` still lands on the tab that has that content today.
 */

class RedirectError extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`)
  }
}
vi.mock('next/navigation', () => ({
  permanentRedirect: (to: string) => {
    throw new RedirectError(to)
  },
}))

const { default: QueueRedirect } = await import('@/app/queue/page')

async function redirectFor(params: { tab?: string; show?: string }): Promise<string> {
  try {
    await QueueRedirect({ searchParams: Promise.resolve(params) })
    throw new Error('did not redirect')
  } catch (e) {
    if (e instanceof RedirectError) return e.to
    throw e
  }
}

describe('/queue redirects to /admin', () => {
  it('with no query at all', async () => {
    expect(await redirectFor({})).toBe('/admin')
  })

  it('maps the old songs tab to work', async () => {
    expect(await redirectFor({ tab: 'songs' })).toBe('/admin?tab=work')
  })

  it('maps the old voices tab to voice', async () => {
    expect(await redirectFor({ tab: 'voices' })).toBe('/admin?tab=voice')
  })

  it('maps the old feedback tab to voice as well', async () => {
    expect(await redirectFor({ tab: 'feedback' })).toBe('/admin?tab=voice')
  })

  it('maps the old enquiries tab to relationships', async () => {
    expect(await redirectFor({ tab: 'enquiries' })).toBe('/admin?tab=relationships')
  })

  it('carries show=all across', async () => {
    expect(await redirectFor({ tab: 'songs', show: 'all' })).toBe('/admin?tab=work&show=all')
  })
})
