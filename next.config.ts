import type { NextConfig } from 'next'

/**
 * Content Security Policy.
 *
 * `'unsafe-inline'` on scripts is not an oversight. The layout deliberately runs a tiny inline
 * script before first paint to add `.js-motion`, and removing it would mean every animated
 * section renders invisible for a frame. Next.js also inlines its own bootstrap. Doing this
 * properly needs a per-request nonce from middleware, which is a real change and a real risk
 * to a working site.
 *
 * It is still worth setting. The XSS surface here is small (React escapes everything, and the
 * only user-supplied text rendered is on the password-gated /leads page), whereas the things
 * this DOES buy are concrete: `frame-ancestors 'none'` prevents /leads being framed and
 * clickjacked, `form-action 'self'` stops an injected form posting credentials elsewhere,
 * `base-uri 'self'` blocks a `<base>` tag hijacking every relative URL, and `object-src 'none'`
 * removes the plugin surface entirely.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://vitals.vercel-insights.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  // Two years, subdomains included. Deliberately NOT `preload`: that is submitted to a browser
  // list and is painful to reverse, which is a commitment to make on purpose, not by default.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Redundant with frame-ancestors for modern browsers, kept for older ones.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      {
        // The enquiry inbox holds other people's contact details. Never cached anywhere,
        // never indexed, never followed, even if something upstream disagrees.
        source: '/leads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
    ]
  },

  /**
   * The apex is canonical: `lyricalglobal.com`, not `www.`.
   *
   * Both hostnames resolve to the same deployment, so without this every page exists at two
   * addresses. That splits search ranking and makes analytics report one visitor journey as
   * two. Matched on the Host header rather than per path, so it covers every route including
   * ones that do not exist yet.
   */
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.lyricalglobal.com' }],
        destination: 'https://lyricalglobal.com/:path*',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
