import { redirect } from 'next/navigation'
import { SongSubmitForm } from '@/components/SongSubmitForm'
import { PageHead, Panel } from '@/components/studio/ui'
import { getEntitlementFor } from '@/lib/entitlement-db'
import { currentUser, supabaseServer } from '@/lib/supabase-server'

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

  // No plan, no form. The gate that matters is inside submitSelfServeJob; this is the polite one.
  const entitlement = await getEntitlementFor(user.id)
  if (!entitlement.ok) redirect('/pricing?why=plan')

  /**
   * The customer's voices, so the form can offer them as the one that sings this song. Read with
   * the user's own client, so RLS returns only theirs. Retired voices are left out: their
   * training audio is gone, so they cannot sing anything new.
   */
  const supabase = await supabaseServer()
  const { data: voiceRows } = await supabase
    .from('voice_models')
    .select('id, artist_name, status')
    .order('created_at', { ascending: false })
  const voices = (voiceRows ?? []).filter((v) => v.status !== 'retired')

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHead
        eyebrow="Create"
        title="Make your song multilingual."
        lead="Upload your stems, pick a language, and hear it re-sung in the same voice. Personal use only."
      />

      <Panel className="sm:p-6">
        {/* v2: the automated self-serve path. Queues the job for the render worker rather than
            the manual /queue funnel. */}
        <SongSubmitForm voices={voices} selfServe />
      </Panel>
    </div>
  )
}
