import Link from 'next/link'
import { Wordmark } from './Wordmark'

/** Nav labels are plain language. Never "Solutions". */
export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-graphite/10 bg-cream/85 backdrop-blur-sm">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4"
      >
        <Link href="/" aria-label="Lyrical, home">
          <Wordmark />
        </Link>

        <div className="ml-auto flex items-center gap-5 text-sm sm:gap-7">
          <Link href="/hear" className="hover:text-indigo">
            Hear it
          </Link>
          <Link href="/#how" className="hidden hover:text-indigo sm:inline">
            How it works
          </Link>
          <Link href="/about" className="hidden hover:text-indigo sm:inline">
            About
          </Link>
          <Link
            href="/#enquire"
            className="bg-indigo px-4 py-2 text-cream transition-colors hover:bg-graphite"
          >
            Start a conversation
          </Link>
        </div>
      </nav>
    </header>
  )
}
