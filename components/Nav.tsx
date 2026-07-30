import Link from 'next/link'
import { Wordmark } from './Wordmark'

/**
 * Nav labels are plain language. Never "Solutions".
 *
 * On a phone the secondary links drop for width, but About is kept: it carries the story,
 * the team and the rights position, and hiding it left a phone visitor with no route to
 * any of that. The call to action shortens instead, which costs nothing.
 *
 * Touch targets use `min-h-11` (44px) rather than a custom class. A custom class defined
 * outside Tailwind's layers outranks utilities and silently breaks `hidden`.
 */
export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-graphite/10 bg-cream/85 backdrop-blur-sm">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-2 sm:gap-6 sm:py-3"
      >
        <Link
          href="/"
          aria-label="Lyrical, home"
          className="inline-flex min-h-11 items-center"
        >
          <Wordmark />
        </Link>

        <div className="ml-auto flex items-center gap-4 text-sm sm:gap-7">
          <Link
            href="/hear"
            className="hidden min-h-11 items-center hover:text-indigo sm:inline-flex"
          >
            Hear it
          </Link>
          <Link
            href="/#how"
            className="hidden min-h-11 items-center hover:text-indigo sm:inline-flex"
          >
            How it works
          </Link>
          <Link
            href="/about"
            className="inline-flex min-h-11 items-center hover:text-indigo"
          >
            About
          </Link>
          <Link
            href="/#enquire"
            className="inline-flex min-h-11 items-center rounded-card bg-indigo px-4 text-cream transition-colors hover:bg-graphite"
          >
            <span className="sm:hidden">Get started</span>
            <span className="hidden sm:inline">Start a conversation</span>
          </Link>
        </div>
      </nav>
    </header>
  )
}
