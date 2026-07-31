import type { NextConfig } from 'next'

/**
 * The apex is canonical: `lyricalglobal.com`, not `www.`.
 *
 * Both hostnames resolve to the same deployment, so without this every page exists at two
 * addresses. That splits search ranking between them and makes analytics report one visitor
 * journey as two. A permanent redirect tells crawlers the move is not temporary, which is
 * what makes the ranking consolidate.
 *
 * Matched on the Host header rather than per path, so it covers every route including ones
 * that do not exist yet.
 */
const nextConfig: NextConfig = {
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
