import team from '@/content/team.json'
import { Reveal } from '../Reveal'

/** Initials in a circle rather than photos — nothing reads as unfinished. */
export default function S09Team() {
  return (
    <section id="team" className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="font-brand text-4xl leading-tight tracking-tight sm:text-5xl">
        Who you&rsquo;ll deal with
      </h2>
      <p className="mt-5 max-w-xl text-graphite/70">
        A small team, which means the people who make the work are the people you talk to.
      </p>

      <div className="mt-14 grid gap-12 sm:grid-cols-2">
        {team.map((m, i) => (
          <Reveal key={m.name} delay={i * 80}>
            <div className="flex items-start gap-5">
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
                <p className="mt-3 leading-relaxed text-graphite/75">{m.bio}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
