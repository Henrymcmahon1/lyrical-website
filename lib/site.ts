/**
 * The site's canonical origin.
 *
 * Falls through in order of trust:
 *   1. NEXT_PUBLIC_SITE_URL   the real domain, once there is one
 *   2. the Vercel production domain, so a deploy without env vars is still correct
 *   3. the per-deployment Vercel URL, correct for previews
 *   4. localhost, for development
 *
 * Without the Vercel fallbacks a production deploy would emit Open Graph tags, a sitemap
 * and a robots.txt all pointing at http://localhost:3000.
 */
/**
 * One description, used by the page metadata, the Open Graph card and the JSON-LD.
 *
 * It lived in two files and was about to live in three. Structured data that disagrees with
 * the meta description is a signal a crawler can only read as carelessness, and this is the
 * exact drift the enquiry addresses already got caught by once.
 *
 * "AI" was removed from this description later the same day, 2026-08-09, after Jordan's
 * feedback that the site read like a technology company explaining itself rather than a
 * product for rights holders. "Music translation" keeps the searchable half of the phrase.
 * The word survives ONLY on `/ai-music-translation`, which exists to catch the search and is
 * deliberately a different job from this one.
 */
export const SITE_DESCRIPTION =
  'Music translation for rights holders. lyrical re-sings a finished record in another ' +
  'language, in the artist’s own voice, over the untouched original backing. No upfront ' +
  'cost, and nothing is released without your approval.'

export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : '') ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  'http://localhost:3000'
