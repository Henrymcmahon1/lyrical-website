import { redirect } from 'next/navigation'
import { JobStatus } from '@/components/JobStatus'
import { LyricsEditor } from '@/components/LyricsEditor'
import { Scorecard } from '@/components/Scorecard'
import { currentUser, supabaseServer } from '@/lib/supabase-server'
import { signOut } from './actions'

/**
 * The studio. Signed in only.
 *
 * Phase 1 in progress: this currently proves the session works end to end and lists whatever
 * the customer has already submitted. The submission form lands next.
 *
 * The job list is read with the USER's client, not the admin one, so RLS decides what comes
 * back. If the policies in `supabase/schema.sql` were wrong, this query would return nothing
 * rather than somebody else's rows, which is the failure direction we want.
 */
export const metadata = {
  title: 'The studio',
  robots: { index: false, follow: false },
}

export default async function Studio({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>
}) {
  const [user, params] = await Promise.all([currentUser(), searchParams])
  if (!user) redirect('/studio/sign-in?next=/studio')

  const supabase = await supabaseServer()
  const { data: jobs } = await supabase
    .from('song_jobs')
    .select(
      'id, title, primary_artist, source_language, target_language, status, created_at, lyrics',
    )
    .order('created_at', { ascending: false })

  return (
    <section className="mx-auto max-w-3xl px-6 py-24 sm:py-28">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">
            The studio
          </span>
          <h1 className="mt-5 font-brand text-4xl leading-[1.1] tracking-tight text-balance">
            Your songs.
          </h1>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="nudge inline-flex min-h-11 items-center text-sm text-graphite/60 underline decoration-graphite/25 underline-offset-4 transition-colors hover:text-graphite"
          >
            Sign out
          </button>
        </form>
      </div>

      <p className="mt-4 text-sm text-graphite/55">Signed in as {user.email}</p>

      {/*
        Voices sit beside songs rather than inside them, because a voice model belongs to an
        ARTIST and is reused by every song that artist sends. Linked from here so somebody who
        arrived to submit a song discovers it, rather than only finding it in an email.
      */}
      {/*
        `flex w-fit`, not `inline-flex`. Both this link and the ember button below are their own
        line in a vertical stack, and an inline-flex element flows inline, so with no submitted
        notice between them the two sat on the SAME line and the button overlapped this link.
        A block-level flex sized to its content takes its own line while staying content-width.
      */}
      <a
        href="/studio/voices"
        className="nudge mt-6 flex w-fit min-h-11 items-center text-sm text-indigo underline decoration-indigo/30 underline-offset-4 transition-colors hover:decoration-indigo"
      >
        Voices we have learned
      </a>

      {params.submitted && (
        <p
          role="status"
          className="mt-8 rounded-card border-l-[3px] border-indigo bg-indigo/5 px-5 py-4 leading-relaxed"
        >
          That is with us. We will confirm we can take it, and nothing is made until we do.
        </p>
      )}

      {/*
        "Another" once they have sent one. The same button greeting a returning customer with
        "Make your song multilingual" reads as though the studio has forgotten the four they
        already have in it.
      */}
      <a
        href="/studio/new"
        className="nudge mt-8 flex w-fit items-center gap-1.5 rounded-card bg-ember px-7 py-4 text-cream"
      >
        {/*
          No `{' '}` between the label and the arrow. This is an inline-flex container, and a
          whitespace-only text node between two flex items is not rendered at all, so the
          explicit space did nothing and the arrow sat against the final letter. `gap-1.5` on
          the container is the separation that actually applies here.
        */}
        {jobs?.length ? 'Make another one multilingual' : 'Make your song multilingual'}
        <span className="shift-arrow">&rarr;</span>
      </a>

      {!jobs?.length ? (
        <p className="mt-12 leading-relaxed text-graphite/75">
          Nothing here yet.
        </p>
      ) : (
        <ul className="mt-12 flex flex-col gap-5">
          {jobs.map((j) => (
            <li key={j.id} className="rounded-card border border-graphite/15 p-6">
              <span className="font-brand text-xl tracking-tight">{j.title}</span>
              <p className="mt-1 text-sm text-graphite/60">
                {j.primary_artist} &middot; {j.source_language} to {j.target_language}
              </p>
              <div className="mt-6">
                <JobStatus status={j.status} />
              </div>

              {/*
                Editable only while the job is still waiting on us. The check here is the UI
                half; the database half is the row policy, which requires the same thing and is
                what actually refuses a forged write.
              */}
              <LyricsEditor
                jobId={j.id}
                initial={j.lyrics ?? ''}
                locked={j.status !== 'submitted'}
              />
            </li>
          ))}
        </ul>
      )}

      {/*
        Under the songs, not above them. Somebody arriving to check on a job wants the job
        first; the method is what they read once they have.
      */}
      <Scorecard />
    </section>
  )
}
