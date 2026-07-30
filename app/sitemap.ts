import type { MetadataRoute } from 'next'
import { SITE_URL as base } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/hear', '/about'].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'monthly',
    priority: path === '' ? 1 : 0.7,
  }))
}
