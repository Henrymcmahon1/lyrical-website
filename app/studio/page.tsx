import { redirect } from 'next/navigation'
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

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Received, waiting on us',
  approved: 'Accepted, in the queue',
  in_progress: 'Being made',
  delivered: 'Delivered',
  rejected: 'Not taken on',
}

export default async function Studio() {
  const user = await currentUser()
  if (!user) redirect('/studio/sign-in?next=/studio')

  const supabase = await supabaseServer()
  const { data: jobs } = await supabase
    .from('song_jobs')
    .select('id, title, primary_artist, source_language, target_language, status, created_at')
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

      {!jobs?.length ? (
        <p className="mt-12 leading-relaxed text-graphite/75">
          Nothing here yet. The submission form is being built and will appear here next.
        </p>
      ) : (
        <ul className="mt-12 border-t border-graphite/12">
          {jobs.map((j) => (
            <li key={j.id} className="border-b border-graphite/12 py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <span className="font-brand text-xl tracking-tight">{j.title}</span>
                <span className="text-sm text-graphite/60">
                  {STATUS_LABEL[j.status] ?? j.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-graphite/60">
                {j.primary_artist} &middot; {j.source_language} to {j.target_language}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
