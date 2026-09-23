import Link from 'next/link'
import { Mark } from './Mark'
import { Trademark } from './Trademark'

/** The STACKED lockup, the primary sanctioned arrangement. Mark above wordmark. */
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
          {/* The short form of the site's one ask. A footer link has no room for the full
              sentence, and "it" is unambiguous next to the other three labels. */}
          <Link href="/studio" className="inline-flex min-h-11 items-center hover:text-indigo">
            Make it multilingual
          </Link>
          {/* One link to the two doors, matching the nav since 2026-09-22. /pricing and /artists
              are reached from the doors section only. */}
          <Link href="/#doors" className="inline-flex min-h-11 items-center hover:text-indigo">Get started</Link>
          {/*
            "Languages" pointed at the standalone `/hear` page until 2026-09-23, when Henry had
            it removed: it mostly duplicated the home page, which already shows the languages
            bloom (`S02bAudience`) and the wheels (`S03Wheels`). This now scrolls to that part of
            the home page directly, via the `id="languages"` anchor in `app/page.tsx`. `/hear`
            itself still resolves, as a redirect to the same anchor (`next.config.ts`).
          */}
          <Link href="/#languages" className="inline-flex min-h-11 items-center hover:text-indigo">
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
