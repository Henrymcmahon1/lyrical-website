import type { MetadataRoute } from 'next'
import { SITE_URL as base } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    // /leads shows other people's contact details, and /listen hosts recordings shared
    // privately for evaluation. Both are password gated, noindex, and disallowed here as
    // well, and neither appears in the sitemap: four independent reasons neither should ever
    // be indexed or stumbled into.
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/leads', '/listen'] }],
    sitemap: `${base}/sitemap.xml`,
  }
}
