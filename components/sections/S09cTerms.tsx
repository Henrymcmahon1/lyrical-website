/**
 * The terms, stated before the reader has to ask for them.
 *
 * Added 2026-08-09 after Jordan's feedback. It exists to answer the last objection standing
 * between reading the page and filling in the form: what does finding out cost me, and what
 * do I give up by trying.
 *
 * This is the first hard COMMERCIAL term the site has ever made. "No upfront cost" was an
 * open question for months, and every version of the closing copy read tentative because of
 * it. Henry settled it on 2026-08-09. If the offer ever changes, this section and the closing
 * ask in `S10Enquire` change together, and so does the confirmation email.
 *
 * Two things deliberately absent:
 *
 * **"No risk."** It was in the draft. Handing over a master and a voice likeness carries
 * risk, and an absolute like that reads to a rights holder's lawyer as either naive or
 * evasive. The specific, true version is the third point below.
 *
 * **Any claim about speed.** "Instantly" was proposed and Henry rejected it in his own words
 * as untrue. There is still no public turnaround commitment anywhere on this site, and that
 * is a decision rather than an oversight.
 *
 * Deliberately still, no animation, for the same reason `S08Rights` is: this section earns
 * trust by being calm.
 */
const TERMS = [
  {
    h: 'No upfront cost',
    p: 'Make one song multilingual and hear what it becomes. There is no invoice for finding out whether this works for your catalog.',
  },
  {
    h: 'You stay in control',
    p: 'You provide the finished master and the approval. Nothing is made without it, and voice models are built only from catalogs we have permission to use.',
  },
  {
    h: 'Nothing is released without your approval',
    p: 'You hear the language version before anyone else does, and it goes no further unless you say so.',
  },
]

export default function S09cTerms() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24" aria-label="What it costs to find out">
      <div className="text-center">
        <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">
          What it costs to find out
        </span>
        <h2 className="mx-auto mt-5 max-w-2xl font-brand text-3xl leading-snug tracking-tight text-balance sm:text-4xl">
          Nothing, until you decide otherwise.
        </h2>
      </div>

      <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
        {TERMS.map((t) => (
          <div key={t.h}>
            <h3 className="font-brand text-xl leading-snug tracking-tight text-indigo">
              {t.h}
            </h3>
            <p className="mt-3 leading-relaxed text-graphite/75">{t.p}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
