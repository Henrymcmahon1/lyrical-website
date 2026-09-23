import type { MetadataRoute } from 'next'
import { SITE_URL as base } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  // `/contact` joined on 2026-08-11 when the enquiry form moved off the home page. It is a
  // real page with its own copy, not a doorway, so it belongs here. `/studio` never will:
  // it is gated, noindex and disallowed in robots.
  //
  // /pricing and /artists joined 2026-09-22 with the two doors. /artists is Bot D's page and
  // this file is Bot B's, so the entry lands a few days before the page does on omega.
  //
  // /hear left 2026-09-23: it is now a redirect into the home page (next.config.ts), not a
  // page of its own, so it has no place in a sitemap of pages.
  return ['', '/pricing', '/artists', '/ai-music-translation', '/about', '/contact'].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'monthly',
    priority: path === '' ? 1 : path === '/pricing' ? 0.9 : 0.7,
  }))
}
