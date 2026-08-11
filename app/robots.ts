import type { MetadataRoute } from 'next'
import { SITE_URL as base } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    // /leads shows other people's contact details, /listen hosts recordings shared privately
    // for evaluation, and /studio is where customers upload unreleased masters. All are gated,
    // noindex, and disallowed here as well, and none appears in the sitemap: four independent
    // reasons none should ever be indexed or stumbled into.
    //
    // /auth is a redirect endpoint that consumes one-time codes. Nothing there is a page, and
    // a crawler following a magic link out of a leaked email would burn the code.
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/auth', '/leads', '/listen', '/studio'] },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
