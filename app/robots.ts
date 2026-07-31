import type { MetadataRoute } from 'next'
import { SITE_URL as base } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    // /leads shows other people's contact details. It is password gated, noindex, and
    // disallowed here as well: three independent reasons it should never be indexed.
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/leads'] }],
    sitemap: `${base}/sitemap.xml`,
  }
}
