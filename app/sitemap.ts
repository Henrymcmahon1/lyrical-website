import type { MetadataRoute } from 'next'
import { SITE_URL as base } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  // `/contact` joined on 2026-08-11 when the enquiry form moved off the home page. It is a
  // real page with its own copy, not a doorway, so it belongs here. `/studio` never will:
  // it is gated, noindex and disallowed in robots.
  return ['', '/ai-music-translation', '/hear', '/about', '/contact'].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'monthly',
    priority: path === '' ? 1 : 0.7,
  }))
}
