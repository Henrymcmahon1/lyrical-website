import Link from 'next/link'
import { Wordmark } from './Wordmark'

/**
 * Rewritten 2026-09 for the two doors. Since Henry's second review on 2026-09-22 it is Home,
 * Get started, Studio. "Get started" is one link to the two-doors section on the home page
 * (`/#doors`); /pricing and /artists are reached from there and nowhere else in the chrome, so
 * a visitor picks a door before they see a price or a term sheet.
 *
 * Nav labels are plain language. Never "Solutions".
 *
 * Touch targets use `min-h-11` (44px) rather than a custom class. A custom class defined
 * outside Tailwind's layers outranks utilities and silently breaks `hidden`.
 */
export function Nav() {
  /*
   * White, not cream, and opaque.
   *
   * White is outside the four locked brand tokens, which is deliberate and Henry's call: the
   * bar reads as a distinct surface sitting above the cream page rather than dissolving into
   * it. The backdrop blur went with the translucency, because blurring behind an opaque layer
   * buys nothing and still costs a compositing layer on every scroll frame.
   *
   * Contrast is unaffected: graphite on white is about 17:1 and indigo about 8.6:1, both well
   * clear of AA.
   */
  return (
    <header className="sticky top-0 z-40 border-b border-graphite/10 bg-white">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-2 sm:gap-6 sm:py-3"
      >
        <Link
          href="/"
          aria-label="lyrical, home"
          className="inline-flex min-h-11 items-center"
        >
          <Wordmark />
        </Link>

        {/*
          At 375px the wordmark (116px) plus four labels overflowed by about 20px and the page
          scrolled sideways. Below `sm` the wordmark is the way home, so Home hides there; the
          other two never wrap and the gaps tighten. All three show from `sm` up.
        */}
        <div className="ml-auto flex items-center gap-3 whitespace-nowrap text-sm sm:gap-7">
          <Link href="/" className="hidden min-h-11 items-center hover:text-indigo sm:inline-flex">Home</Link>
          <Link href="/#doors" className="inline-flex min-h-11 items-center hover:text-indigo">Get started</Link>
          <Link href="/studio" className="inline-flex min-h-11 items-center rounded-card bg-indigo px-3 text-cream transition-colors hover:bg-graphite sm:px-4">Studio</Link>
        </div>
      </nav>
    </header>
  )
}
