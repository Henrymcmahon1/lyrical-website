import { existsSync } from 'node:fs'
import { join } from 'node:path'
import Image from 'next/image'
import team from '@/content/team.json'
import { Stagger } from '../Stagger'

/** Filename-safe form of a person's name: "Jordan Brock" becomes "jordan-brock". */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Look for a portrait on disk and fall back to the initials if there is not one.
 *
 * Checked rather than assumed, so dropping a file into `public/team/` is the entire action
 * needed to add a photo, and a missing file can never render as a broken image. This runs on
 * the server while the page is built, never in the browser.
 *
 * To add one: `public/team/jordan-brock.jpg`, `public/team/henry-mcmahon.jpg`. Square crop,
 * 800x800 or larger. `.jpg`, `.jpeg`, `.webp` and `.png` are all picked up.
 */
function findPortrait(name: string): string | null {
  for (const ext of ['jpg', 'jpeg', 'webp', 'png']) {
    const rel = `/team/${slug(name)}.${ext}`
    if (existsSync(join(process.cwd(), 'public', rel))) return rel
  }
  return null
}

/**
 * `detail` controls depth. The home page is a funnel and gets one line each; /about is where
 * somebody already interested goes to decide whether they trust you, so it carries the full
 * bios, folded so they do not dominate the page.
 */
export default function S09Team({ detail = false }: { detail?: boolean }) {
  return (
    <section id="team" className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="font-brand text-4xl leading-tight tracking-tight sm:text-5xl">
        Who you&rsquo;ll deal with
      </h2>
      <p className="mt-5 max-w-xl text-graphite/70">
        A small team, which means the people who make the work are the people you talk to.
      </p>

      <Stagger
        className={`mt-14 grid gap-12 ${detail ? 'md:grid-cols-2 md:gap-16' : 'sm:grid-cols-2'}`}
      >
        {team.map((m) => {
          const portrait = findPortrait(m.name)

          return (
            <div key={m.name} className={detail ? undefined : 'nudge flex items-start gap-5'}>
              <div className={detail ? 'flex items-center gap-4' : 'contents'}>
                {portrait ? (
                  <Image
                    src={portrait}
                    alt=""
                    width={224}
                    height={224}
                    sizes={detail ? '80px' : '56px'}
                    className={`shrink-0 rounded-full object-cover ${
                      detail ? 'h-20 w-20' : 'h-14 w-14'
                    }`}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className={`flex shrink-0 items-center justify-center rounded-full border border-indigo font-mono text-sm text-indigo ${
                      detail ? 'h-20 w-20' : 'h-14 w-14'
                    }`}
                  >
                    {m.initials}
                  </span>
                )}

                <div>
                  <h3 className="font-brand text-2xl tracking-tight">{m.name}</h3>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite/50">
                    {m.role}
                  </p>
                  {!detail && (
                    <p className="mt-3 leading-relaxed text-graphite/75">{m.short}</p>
                  )}
                </div>
              </div>

              {detail && (
                <>
                  <p className="mt-5 leading-relaxed text-graphite/75">{m.short}</p>

                  {/*
                    Native <details>, so the background reads with JavaScript disabled and
                    find-in-page can still reach inside it.
                  */}
                  <details className="group mt-4">
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-indigo [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">
                        Background on {m.name.split(' ')[0]}
                      </span>
                      <span className="hidden group-open:inline">Close</span>
                      <span
                        aria-hidden="true"
                        className="transition-transform duration-300 group-open:rotate-90"
                      >
                        &rarr;
                      </span>
                    </summary>

                    <div className="mt-4 flex flex-col gap-4">
                      {m.full.map((para) => (
                        <p key={para.slice(0, 24)} className="leading-relaxed text-graphite/75">
                          {para}
                        </p>
                      ))}
                    </div>
                  </details>
                </>
              )}
            </div>
          )
        })}
      </Stagger>
    </section>
  )
}
