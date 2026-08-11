import { CONTACT_EMAIL } from './enquiry-email'
import { SITE_DESCRIPTION, SITE_URL } from './site'

/**
 * JSON-LD for the home page.
 *
 * The job is narrow and worth stating, because structured data attracts invention: it tells
 * a crawler that "lyrical" is an ENTITY rather than an English adjective. Without it the
 * brand name is a dictionary word competing with a record label and every lyrics site, and
 * nothing on the page says otherwise in a form a machine reads.
 *
 * Two rules held here:
 *
 * **Nothing is asserted that is not already public on the page.** Structured data that
 * contradicts the visible page is a manual-action risk, and this site's whole argument is
 * that it handles other people's property carefully. So: no address (the company location is
 * not stated anywhere public), no founding date (not established), no employee count, no
 * aggregate rating, no offers. If it is not on the page, it is not here.
 *
 * **`alternateName` carries the real discoverability work.** "lyrical" is unrankable on its
 * own. "lyrical Global" is what people will actually search once it is on LinkedIn and in
 * directories, and it matches the domain, so both names have to resolve to one entity.
 */

/**
 * Third-party profiles for `sameAs`, which is how a crawler connects a mention elsewhere
 * back to this entity. It is the single most useful field here and it is deliberately EMPTY
 * until a profile actually exists: a `sameAs` pointing at a 404 is worse than no `sameAs`,
 * because it asserts a relationship that cannot be verified.
 *
 * Add the LinkedIn URL the moment the page is live.
 */
export const PROFILES: string[] = []

// One source, shared with the page metadata and the Open Graph card. Structured data that
// disagrees with the visible description is a signal a crawler reads as carelessness.
const DESCRIPTION = SITE_DESCRIPTION

export function organizationLd(origin: string = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: 'lyrical',
    alternateName: 'lyrical global',
    url: origin,
    logo: `${origin}/brand/lyrical-lockup.png`,
    image: `${origin}/og.png`,
    description: DESCRIPTION,
    email: CONTACT_EMAIL,
    ...(PROFILES.length ? { sameAs: PROFILES } : {}),
  }
}

export function websiteLd(origin: string = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: 'lyrical',
    url: origin,
    description: DESCRIPTION,
    publisher: { '@id': `${origin}/#organization` },
    inLanguage: 'en',
  }
}

/**
 * Serialised for a `<script type="application/ld+json">`.
 *
 * `<` is escaped because the payload is injected with `dangerouslySetInnerHTML`, and a raw
 * `</script>` appearing inside any string value would close the tag early and spill the rest
 * of the document into the page as markup. None of the current values contain one, which is
 * exactly why it has to be handled here rather than trusted to stay true.
 */
export function ldJson(...blocks: object[]): string {
  return JSON.stringify(blocks.length === 1 ? blocks[0] : blocks).replace(/</g, '\\u003c')
}
