import Link from 'next/link'
import { Mark } from './Mark'

/** The STACKED lockup — the primary, sanctioned arrangement. Mark above wordmark. */
export function Footer() {
  return (
    <footer className="border-t border-graphite/10 px-6 py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center">
        <Mark size={44} className="text-indigo" />
        <span className="font-brand text-3xl tracking-tight">lyrical</span>
        <p className="font-brand text-lg text-graphite/70">
          Every song. Any language. Same soul.
        </p>

        <nav
          aria-label="Footer"
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm"
        >
          <Link href="/hear" className="inline-flex min-h-11 items-center hover:text-indigo">
            Hear it
          </Link>
          <Link href="/about" className="inline-flex min-h-11 items-center hover:text-indigo">
            About
          </Link>
          <Link href="/#enquire" className="inline-flex min-h-11 items-center hover:text-indigo">
            Start a conversation
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
