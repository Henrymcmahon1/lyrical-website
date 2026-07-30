import type { Metadata } from 'next'
import { bodoni, archivo } from '@/lib/fonts'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { SmoothScroll } from '@/components/SmoothScroll'
import './globals.css'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

const DESCRIPTION =
  'Lyrical recreates a finished record in another language, in the artist’s own voice, ' +
  'over the untouched original backing. Melody, rhythm and feel kept intact.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'Lyrical — One song. Any language. Same soul.',
    template: '%s — Lyrical',
  },
  description: DESCRIPTION,
  openGraph: {
    title: 'Lyrical — One song. Any language. Same soul.',
    description: DESCRIPTION,
    type: 'website',
    url: SITE,
    siteName: 'Lyrical',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${bodoni.variable} ${archivo.variable} h-full`}>
      <head>
        {/*
          Opt in to reveal animations before first paint. If JS is disabled this never
          runs, the class is absent, and every section renders plainly visible — which is
          exactly the desired fallback. Kept inline and tiny so there is no flash.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('js-motion')}}catch(e){}",
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <SmoothScroll />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-indigo focus:px-4 focus:py-2 focus:text-cream"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
