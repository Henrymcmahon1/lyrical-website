import { redirect } from 'next/navigation'
import { currentUser, supabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getBillingSummary } from '@/lib/entitlement-db'
import { getEmailPreferences } from '@/lib/account-data'
import { planById } from '@/lib/plans'
import {
  LICENCE_TERMS_INTRO,
  LICENCE_TERMS_POINTS,
  RIGHTS_TERMS_INTRO,
  RIGHTS_TERMS_POINTS,
  RIGHTS_TERMS_VERSION,
} from '@/lib/terms'
import { TURNAROUND_BUSY, TURNAROUND_PROMISE } from '@/lib/turnaround'
import { PageHead, Panel, StatChip, link, button } from '@/components/studio/ui'
import { EmailPreferencesForm } from './EmailPreferencesForm'
import { DeleteAccountForm } from './DeleteAccountForm'

/**
 * A proper account page: who is signed in and how, the plan, the turnaround promise, what was
 * agreed and when, email preferences, a data export and a guarded soft delete. Every ordinary
 * read is the USER's client (RLS); the two privileged operations, the data export and the
 * delete, run through lib/account-data.ts on the service-role client and are never done here
 * directly. Same shell and panel language as the rest of the studio (components/studio/ui.tsx).
 */
export const metadata = { title: 'Account', robots: { index: false, follow: false } }

const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : null

export default async function Account() {
  const user = await currentUser()
  if (!user) redirect('/studio/sign-in?next=/studio/account')

  const supabase = await supabaseServer()
  const admin = supabaseAdmin()

  const [{ data: profileRow }, { data: rightsRow }, { data: licenceRow }, billing, prefs] = await Promise.all([
    supabase.from('profiles').select('name, licence_terms_version').eq('id', user.id).maybeSingle(),
    // Most recent agreement: the rights warranty is re-agreed on every submission.
    supabase.from('song_jobs').select('rights_warranted_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    // First self-serve submission: when the personal-use licence was first accepted.
    supabase
      .from('song_jobs')
      .select('created_at')
      .not('licence_terms_version', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    getBillingSummary(user.id, admin),
    getEmailPreferences(admin, user.id),
  ])

  const profile = profileRow as { name: string | null; licence_terms_version: string | null } | null
  const rightsDate = day((rightsRow as { rights_warranted_at?: string } | null)?.rights_warranted_at)
  const licenceDate = day((licenceRow as { created_at?: string } | null)?.created_at)
  const licenceVersion = profile?.licence_terms_version ?? null

  const plan = billing.entitlement.ok ? planById(billing.entitlement.plan) : null
  const renews = billing.entitlement.ok && billing.entitlement.renewsAt ? day(billing.entitlement.renewsAt) : null

  // Supabase identities carry the auth methods this account has ever used. Google if it is
  // among them; otherwise the only other method the studio offers, the 6-digit email code.
  const identities = (user.identities ?? []) as { provider?: string }[]
  const signInMethod = identities.some((i) => i.provider === 'google') ? 'Google' : 'Email code'

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHead eyebrow="The studio" title="Your account." />

      <Panel title="You">
        <div className="flex flex-wrap gap-2">
          <StatChip label="Name" value={profile?.name?.trim() || 'Not set'} />
          <StatChip label="Email" value={user.email} />
          <StatChip label="Signed in with" value={signInMethod} />
        </div>
      </Panel>

      <Panel title={billing.entitlement.ok ? 'Plan' : 'No plan yet'}>
        {billing.entitlement.ok ? (
          <>
            <div className="flex flex-wrap gap-2">
              <StatChip label="Plan" value={plan?.name ?? 'Single'} />
              <StatChip label="Tracks left" value={billing.entitlement.tracksLeft} tone={billing.entitlement.tracksLeft === 0 ? 'action' : 'neutral'} />
              {renews ? <StatChip label="Renews" value={renews} /> : null}
              <StatChip label="Single credits" value={billing.creditBalance} />
            </div>
          </>
        ) : (
          <p className="font-product text-sm leading-relaxed text-dark-ink/70">
            No active plan. {billing.creditBalance > 0 ? `${billing.creditBalance} Single credit${billing.creditBalance === 1 ? '' : 's'} on hand.` : ''}
          </p>
        )}
        <a href="/studio/billing" className={`mt-4 inline-block ${link}`}>Manage plan</a>
      </Panel>

      <Panel title="Turnaround">
        <p className="font-product text-sm leading-relaxed text-dark-ink/70">
          {TURNAROUND_PROMISE}, {TURNAROUND_BUSY}.
        </p>
      </Panel>

      <Panel title="Rights and licence">
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-product text-sm leading-relaxed text-dark-ink/80">
              Rights warranty, version {RIGHTS_TERMS_VERSION}
              {rightsDate ? `, agreed ${rightsDate}` : ', not yet agreed'}.
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer font-product text-sm text-dark-ink/60">Read the rights warranty</summary>
              <div className="mt-2 font-product text-sm leading-relaxed text-dark-ink/70">
                <p>{RIGHTS_TERMS_INTRO}</p>
                <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5">
                  {RIGHTS_TERMS_POINTS.map((p) => <li key={p}>{p}</li>)}
                </ol>
              </div>
            </details>
          </div>
          <div>
            <p className="font-product text-sm leading-relaxed text-dark-ink/80">
              {licenceVersion
                ? `Personal-use licence, version ${licenceVersion}${licenceDate ? `, accepted ${licenceDate}` : ''}.`
                : 'Personal-use licence: not yet accepted.'}
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer font-product text-sm text-dark-ink/60">Read the personal-use licence</summary>
              <div className="mt-2 font-product text-sm leading-relaxed text-dark-ink/70">
                <p>{LICENCE_TERMS_INTRO}</p>
                <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5">
                  {LICENCE_TERMS_POINTS.map((p) => <li key={p}>{p}</li>)}
                </ol>
              </div>
            </details>
          </div>
        </div>
      </Panel>

      <Panel title="Email preferences">
        <EmailPreferencesForm productEmails={prefs.productEmails} ratingReminders={prefs.ratingReminders} available={prefs.available} />
      </Panel>

      <Panel title="Your data">
        <p className="font-product text-sm leading-relaxed text-dark-ink/70">
          A JSON file of your tracks, feedback, credits and deliveries.
        </p>
        <a href="/studio/account/download" download className={`mt-4 inline-block ${button.ghost}`}>Download my data</a>
      </Panel>

      <Panel title="Delete account">
        <DeleteAccountForm />
      </Panel>
    </div>
  )
}
