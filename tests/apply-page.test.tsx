import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Apply from '@/app/apply/page'

const html = () => renderToStaticMarkup(<Apply />)

describe('the /apply Door 1 page', () => {
  it('tags submissions with the door1-application source', () => {
    expect(html()).toContain('value="door1-application"')
  })

  it('frames the partnership, not a checkout', () => {
    const out = html()
    expect(out).toMatch(/partnership/i)
    expect(out).toMatch(/revenue share/i)
  })

  it('uses no em dash and never says AI-generated', () => {
    const out = html()
    expect(out).not.toContain('—')
    expect(out).not.toMatch(/AI-generated/)
  })
})
