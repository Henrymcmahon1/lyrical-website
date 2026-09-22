import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/** The Voice tab's feedback filters: by rating and by tag, applied to the Supabase query itself. */

const eq = vi.fn()
const contains = vi.fn()
const limit = vi.fn()

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        order: () => chain,
        limit: (...a: unknown[]) => {
          limit(...a)
          return chain
        },
        eq: (...a: unknown[]) => {
          eq(...a)
          return chain
        },
        contains: (...a: unknown[]) => {
          contains(...a)
          return chain
        },
        then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      }
      return chain
    },
  }),
}))

beforeEach(() => vi.clearAllMocks())

describe('FeedbackTab filters', () => {
  it('applies no filter by default', async () => {
    const { FeedbackTab } = await import('@/app/admin/FeedbackTab')
    await FeedbackTab()
    expect(eq).not.toHaveBeenCalled()
    expect(contains).not.toHaveBeenCalled()
  })

  it('filters by rating', async () => {
    const { FeedbackTab } = await import('@/app/admin/FeedbackTab')
    await FeedbackTab({ rating: 'down' })
    expect(eq).toHaveBeenCalledWith('rating', 'down')
  })

  it('filters by tag', async () => {
    const { FeedbackTab } = await import('@/app/admin/FeedbackTab')
    await FeedbackTab({ tag: 'timing' })
    expect(contains).toHaveBeenCalledWith('tags', ['timing'])
  })

  it('renders the filter links so the current choice is marked', async () => {
    const { FeedbackTab } = await import('@/app/admin/FeedbackTab')
    const html = renderToStaticMarkup(await FeedbackTab({ rating: 'down', tag: 'timing' }))
    expect(html).toContain('rating=down')
    expect(html).toContain('tag=timing')
  })
})
