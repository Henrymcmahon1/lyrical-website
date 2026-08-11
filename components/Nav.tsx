import Link from 'next/link'
import { Wordmark } from './Wordmark'

/**
 * One destination and one action, at every width.
 *
 * The phone layout was the honest one, so desktop now matches it rather than the other way
 * round. Two links went:
 *
 * - **Hear it** pointed at a page that promises "hear the original against the recreated
 *   version" and has nothing to play, so the most prominent link on every page advertised
 *   the site's biggest gap. Put it back the day real audio publishes; it will be the best
 *   link here.
 * - **How it works** was an anchor into the middle of a page that is now two content
 *   sections and about ten screens. Anybody scrolling reaches it without help.
 *
 * What remains is what a rights holder actually needs: About, which carries the rights
 * position and the team, and the way to make contact.
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

        <div className="ml-auto flex items-center gap-4 text-sm sm:gap-7">
          <Link
            href="/about"
            className="inline-flex min-h-11 items-center hover:text-indigo"
          >
            About
          </Link>
          {/*
            One label at both widths. It used to read "Get started" on a phone and "Start a
            conversation" on desktop, which is two voices for one button.

            It pointed at `/#enquire` until 2026-08-11 and now points at the studio: the nav
            action and the hero action have to agree about what the site wants, and what it
            wants is a song. `/contact` is one click further on, from the closing section of
            every page and from the hero's second button.
          */}
          <Link
            href="/studio"
            className="inline-flex min-h-11 items-center rounded-card bg-indigo px-4 text-cream transition-colors hover:bg-graphite"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  )
}
