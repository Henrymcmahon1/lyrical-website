import type { MetadataRoute } from 'next'
import { SITE_URL as base } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    // /queue shows other people's contact details AND their unreleased recordings, /listen
    // hosts recordings shared privately for evaluation, and /studio is where customers upload
    // masters. All are gated, noindex, and disallowed here as well, and none appears in the
    // sitemap: four independent reasons none should ever be indexed or stumbled into.
    //
    // /leads is kept because it is still a live URL, now a redirect into /queue. A disallowed
    // redirect is the belt-and-braces version: the crawler stops at the door rather than
    // following it to a page it is also not allowed to have.
    //
    // /auth is a redirect endpoint that consumes one-time codes. Nothing there is a page, and
    // a crawler following a magic link out of a leaked email would burn the code.
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth', '/leads', '/listen', '/queue', '/studio'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
