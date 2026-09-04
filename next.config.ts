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
/**
 * Where the /listen recordings are served from.
 *
 * They live in a private Supabase bucket and are fetched over a signed URL, so media is
 * CROSS-ORIGIN. Without a `media-src` of its own, media falls back to `default-src 'self'`
 * and the browser refuses the file with "Media load rejected by URL safety check": players
 * render, then sit at 0:00 with dead controls and nothing in the console until play is
 * pressed, because `preload="none"` means nothing is fetched before then.
 *
 * Derived rather than written out, so it stays correct if the project ever moves. The
 * wildcard fallback covers a build where the variable is absent: without it the audio
 * silently stops working, and this grants media only, never script.
 *
 * Reads the PUBLIC variable first, added 2026-08-09 for the portal. The browser now talks to
 * Supabase directly for auth and for uploads, and the origin it uses comes from
 * `NEXT_PUBLIC_SUPABASE_URL`. `SUPABASE_URL` stays as the fallback so a build that only has
 * the server-side variable still emits a correct `media-src` for /listen.
 */
const SUPABASE_ORIGIN = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  try {
    return raw ? new URL(raw).origin : null
  } catch {
    return null
  }
})()

const SUPABASE_SRC = SUPABASE_ORIGIN ?? 'https://*.supabase.co'

/*
  Cloudflare Turnstile, added 2026-08-30. The anti-bot widget on the studio sign-in and submit
  forms. Its script loads from `challenges.cloudflare.com` (script-src), it draws the challenge
  in an iframe from the same origin (frame-src, which had no directive and was falling back to
  `default-src 'self'`, so the iframe would have been blocked), and the widget calls back to that
  origin (connect-src). Token verification is server-side and needs nothing here. Scoped to the
  one host, so this grants Cloudflare the challenge surface and nothing wider.
*/
const TURNSTILE_SRC = 'https://challenges.cloudflare.com'

/*
  RB2B, added 2026-08-31. Visitor de-anonymisation for lead gen. The inline loader in the layout
  injects RB2B's script from the CloudFront host below (script-src). Verified against the live
  site: the script itself beacons FIRST-PARTY, POSTing to `/<id>/view` on our own origin, which
  `connect-src 'self'` already covers, so no external connect host is needed and none is granted.
  `api.reb2b.com` is kept as a narrow, RB2B-specific margin in case a flow this test did not hit
  falls back to it; if a CSP violation ever names another host, that is the signal to add exactly
  it, never a broad one like a whole S3 region.
*/
const REB2B_SCRIPT_SRC = 'https://ddwl4m2hdecbv.cloudfront.net'
const REB2B_CONNECT_SRC = 'https://api.reb2b.com'

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com ${TURNSTILE_SRC} ${REB2B_SCRIPT_SRC}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `media-src 'self' ${SUPABASE_SRC}`,
  /*
    Supabase added 2026-08-09. The portal signs in and uploads from the BROWSER, so those
    requests are cross-origin XHR. Without this they are refused by `default-src 'self'` and
    the failure is the same shape as the media-src one that cost a session: the form renders,
    the button does nothing, and the only clue is a console line nobody reads until they think
    to look. Uploads especially, since a 60MB PUT that never leaves the page looks like a slow
    network rather than a policy refusal.
  */
  `connect-src 'self' https://vitals.vercel-insights.com ${SUPABASE_SRC} ${TURNSTILE_SRC} ${REB2B_SCRIPT_SRC} ${REB2B_CONNECT_SRC}`,
  `frame-src ${TURNSTILE_SRC}`,
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
