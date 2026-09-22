import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import S02bAudience from '@/components/sections/S02bAudience'

/**
 * The audience section now accepts a `coffey` slot, rendered by the server page (Coffey's
 * signed URLs need `supabaseAdmin`, which a client component must never touch). The slot is
 * optional so the section still renders correctly on its own, with no player, when the env
 * is unset.
 */
describe('S02bAudience', () => {
  it('renders the section with no player when no coffey slot is passed', () => {
    const html = renderToStaticMarkup(<S02bAudience />)
    expect(html).toContain('Everyone who was always going to love it.')
    expect(html).not.toContain('Coffey Anderson')
  })

  it('renders the passed-in coffey slot inside the section', () => {
    const html = renderToStaticMarkup(
      <S02bAudience coffey={<div data-testid="coffey-stub">Coffey Anderson stub</div>} />,
    )
    expect(html).toContain('data-testid="coffey-stub"')
    expect(html).toContain('Coffey Anderson stub')
    // Still inside the same <section>, after the pinned track, not a sibling section.
    expect(html.match(/<section/g)?.length).toBe(1)
  })
})
