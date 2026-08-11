import { describe, expect, it } from 'vitest'
import { PROFILES, ldJson, organizationLd, websiteLd } from '@/lib/structured-data'

/**
 * These assert commitments, not shape.
 *
 * Structured data is the one place on this site where it is trivially easy to tell Google
 * something that is not true, because nobody sees it. Every test here exists to stop a future
 * session quietly adding a claim that the visible page does not support.
 */

const ORIGIN = 'https://lyricalglobal.com'

describe('organization', () => {
  it('claims both names, because one of them is unrankable alone', () => {
    const o = organizationLd(ORIGIN)
    // Lowercase, on Henry's instruction 2026-08-09. The wordmark was always lowercase; the
    // prose, the metadata and this entity name now match it.
    expect(o.name).toBe('lyrical')
    // "Lyrical" is a dictionary word. "Lyrical Global" is what a person actually searches,
    // and it matches the domain. Both have to resolve to one entity or the LinkedIn page and
    // the site look like two different companies.
    expect(o.alternateName).toBe('lyrical global')
  })

  it('asserts nothing the public page does not', () => {
    const o = organizationLd(ORIGIN) as Record<string, unknown>
    // No address: the company's location is not stated anywhere public.
    // No foundingDate, employee count, rating or offer: none of it is established.
    for (const invented of [
      'address',
      'foundingDate',
      'numberOfEmployees',
      'aggregateRating',
      'makesOffer',
      'priceRange',
      'telephone',
    ]) {
      expect(o[invented]).toBeUndefined()
    }
  })

  it('omits sameAs entirely while there are no profiles to point at', () => {
    const o = organizationLd(ORIGIN) as Record<string, unknown>
    // A sameAs pointing at a page that does not exist asserts a relationship a crawler
    // cannot verify, which is worse than staying silent. When the LinkedIn page is live,
    // PROFILES gets the URL and this test starts asserting the opposite.
    if (PROFILES.length === 0) expect(o.sameAs).toBeUndefined()
    else expect(o.sameAs).toEqual(PROFILES)
  })

  it('uses absolute URLs on the given origin', () => {
    const o = organizationLd(ORIGIN)
    for (const url of [o.url, o.logo, o.image]) {
      expect(url.startsWith(`${ORIGIN}/`) || url === ORIGIN).toBe(true)
    }
  })
})

describe('website', () => {
  it('points its publisher at the organization node', () => {
    // Two loose blocks describe two unrelated things. The @id reference is what makes them
    // one entity to a crawler.
    expect(websiteLd(ORIGIN).publisher).toEqual({ '@id': `${ORIGIN}/#organization` })
  })
})

describe('serialisation', () => {
  it('escapes < so a value can never close the script tag', () => {
    // The payload is injected with dangerouslySetInnerHTML. A raw </script> inside any string
    // would end the block early and spill the rest of the document into the page as markup.
    // No current value contains one, which is exactly why this cannot be left to chance.
    const out = ldJson({ evil: '</script><img onerror=alert(1)>' })
    expect(out).not.toContain('</script>')
    expect(out).toContain('\\u003c')
  })

  it('stays valid JSON after escaping', () => {
    const parsed = JSON.parse(ldJson(organizationLd(ORIGIN), websiteLd(ORIGIN)))
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(2)
  })
})
