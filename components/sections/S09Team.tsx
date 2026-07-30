import team from '@/content/team.json'
import { Stagger } from '../Stagger'

/**
 * Initials in a circle rather than photos, so nothing reads as unfinished.
 *
 * `detail` controls depth. The home page is a funnel and gets one line each; /about is
 * where somebody already interested goes to decide whether they trust you, so it gets
 * the full bios.
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
        {team.map((m) => (
          <div key={m.name} className={detail ? undefined : 'nudge flex items-start gap-5'}>
            <div className={detail ? 'flex items-center gap-4' : 'contents'}>
              <span
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-indigo font-mono text-sm text-indigo"
              >
                {m.initials}
              </span>
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
              <div className="mt-5 flex flex-col gap-4">
                {m.full.map((para) => (
                  <p key={para.slice(0, 24)} className="leading-relaxed text-graphite/75">
                    {para}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </Stagger>
    </section>
  )
}
