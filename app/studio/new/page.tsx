import { redirect } from 'next/navigation'
import { SongSubmitForm } from '@/components/SongSubmitForm'
import { currentUser } from '@/lib/supabase-server'

/**
 * Where a song is handed over.
 *
 * Signed in only, and that is a compromise rather than the design I would choose. The plan was
 * to let somebody fill the form first and ask for an account at submit, because a sign in wall
 * is the biggest drop-off point in any funnel.
 *
 * Magic links break that. The account step sends the visitor to their email and back, and
 * anything they had picked in a file input is gone when they return, so "form first" would
 * mean losing their uploads. Doing the email round trip BEFORE they invest effort is the less
 * annoying order of the two.
 *
 * The fix is a six digit code instead of a link, which keeps them on the page and preserves
 * form state. That needs a custom email template, which needs custom SMTP, which is not set up
 * yet. When Resend SMTP lands, revisit this and move the wall back to submit.
 */
export const metadata = {
  title: 'Make your song multilingual',
  robots: { index: false, follow: false },
}

export default async function NewSong() {
  const user = await currentUser()
  if (!user) redirect('/studio/sign-in?next=/studio/new')

  return (
    <section className="mx-auto max-w-2xl px-6 py-24 sm:py-28">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">The studio</span>
      <h1 className="mt-5 font-brand text-4xl leading-[1.1] tracking-tight text-balance">
        Make your song multilingual.
      </h1>
      <p className="mt-6 leading-relaxed text-graphite/75">
        Give us the recording and the language you want it in. No upfront cost, and nothing is
        released without your approval.
      </p>

      <div className="mt-12">
        <SongSubmitForm />
      </div>
    </section>
  )
}
