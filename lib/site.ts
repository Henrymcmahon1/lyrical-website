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
 * "AI music translation" leads it on Henry's instruction, 2026-08-09. See the copy rules in
 * CLAUDE.md: "AI" as a category label is allowed, the hyphenated machine-made pairing is not,
 * and `tests/copy.test.ts` still fails the build on it.
 */
export const SITE_DESCRIPTION =
  'AI music translation for rights holders. Lyrical re-sings a finished record in another ' +
  'language, in the artist’s own voice, over the untouched original backing. Melody, rhythm ' +
  'and feel kept intact.'

export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : '') ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  'http://localhost:3000'
