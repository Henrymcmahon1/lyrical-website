import Link from 'next/link'
import { Mark } from './Mark'
import { Trademark } from './Trademark'

/** The STACKED lockup — the primary, sanctioned arrangement. Mark above wordmark. */
export function Footer() {
  return (
    <footer className="border-t border-graphite/10 px-6 py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center">
        <Mark size={44} className="text-indigo" />
        <span className="font-brand text-3xl tracking-tight">
          lyrical
          <Trademark />
        </span>
        <p className="font-brand text-lg text-graphite/70">
          Every song. Any language. Same soul.
        </p>

        <nav
          aria-label="Footer"
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm"
        >
          {/*
            "Hear it" became "Languages" on 2026-08-11. The label promised playback that the
            page cannot deliver, which is the same fault the nav link was removed for a session
            earlier. The page is kept and linked, because an orphan page in the sitemap is worse
            than a page with an honest name, and it is the only internal link /hear now has.
          */}
          <Link href="/studio" className="inline-flex min-h-11 items-center hover:text-indigo">
            Send a song
          </Link>
          <Link href="/hear" className="inline-flex min-h-11 items-center hover:text-indigo">
            Languages
          </Link>
          <Link href="/about" className="inline-flex min-h-11 items-center hover:text-indigo">
            About
          </Link>
          <Link href="/contact" className="inline-flex min-h-11 items-center hover:text-indigo">
            Contact
          </Link>
        </nav>

        <p className="mt-8 max-w-md text-xs leading-relaxed text-graphite/50">
          Artist voices are used only with the artist&rsquo;s or rights holder&rsquo;s
          permission.
        </p>
      </div>
    </footer>
  )
}
