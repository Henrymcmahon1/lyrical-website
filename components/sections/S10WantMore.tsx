import Link from 'next/link'

/**
 * "Want more?", the home page's one deliberately quiet section.
 *
 * Added 2026-09-23 on Henry's instruction: he wants a way to learn more about lyrical from
 * the home page itself, not the nav, plus a home-page entry point for investors and one for
 * contact. This is that section, and it is placed AFTER `S09cDoors` in `app/page.tsx` on
 * purpose, below the fold that matters. The primary ask on this page is the two doors above:
 * this section must never compete with them for attention, so there is no fill colour, no
 * large type, and no repeat of the ember action colour those buttons use.
 *
 * ## Colour band
 *
 * Cream, deliberately: no `bg-*` override here, so the section inherits the page's own
 * `--color-cream` background from `globals.css`. `S09cDoors` immediately above it is the
 * page's one dark band, and a second dark section directly under it would create the exact
 * seam `/hear` used to document (two near-identical blacks with nothing between them). Cream
 * under dark is the one safe step.
 *
 * Indigo is avoided on this section specifically (graphite and a small ember accent only):
 * `tests/home.test.tsx` slices the rendered home page from `id="doors"` onward and asserts
 * nothing after it uses `bg-indigo` or `text-indigo`, since indigo fails contrast on the dark
 * ground above. Staying off indigo here keeps that assertion honest without needing a special
 * case for a cream section that happens to render after a dark one.
 */
const LINKS = [
  { href: '/about', label: 'Our story', hint: 'Why lyrical exists, and what has shipped so far.' },
  { href: '/investors', label: 'Invest', hint: 'The two-doors business, from the inside.' },
  { href: '/contact', label: 'Contact', hint: 'A person replies, usually within a day.' },
]

export default function S10WantMore() {
  return (
    <section aria-label="Want more?" className="py-20 sm:py-24">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45">
          Want more?
        </span>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="nudge group flex flex-col items-center gap-2 rounded-card border border-graphite/15 px-6 py-8 text-center transition-colors hover:border-ember/50"
            >
              <span className="font-brand text-xl tracking-tight text-graphite">
                {l.label} <span className="shift-arrow text-ember">&rarr;</span>
              </span>
              <span className="text-sm leading-relaxed text-graphite/60">{l.hint}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
