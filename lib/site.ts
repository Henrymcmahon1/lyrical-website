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
export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : '') ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  'http://localhost:3000'
