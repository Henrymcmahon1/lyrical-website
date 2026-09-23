import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin-session'
import { DOOR1 } from '@/lib/door1-schema'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Door1Head, SHELL, refusedView } from '../shared'
import { Door1JobForm, type EnquiryOption } from './Door1JobForm'

/**
 * `/admin/door1/new`: the create form.
 *
 * Break-glass may not create (a job needs the admin's auth uid as `user_id`), so a break-glass
 * session sees why instead of the form. Everything handed to the client form is plain data:
 * never a function prop from this server component.
 */
export const metadata: Metadata = {
  title: 'New Door 1 job',
  robots: { index: false, follow: false, nocache: true },
}
export const dynamic = 'force-dynamic'

export default async function NewDoor1Job() {
  const admin = await requireAdmin()
  const refused = refusedView(admin)
  if (refused) return refused

  if (admin.ok && admin.via !== 'identity') {
    return (
      <section className={`${SHELL} py-16`}>
        <Door1Head title="New Door 1 job" />
        <p role="alert" className="mt-8 max-w-xl text-graphite/80">
          You are in a break-glass session. Creating a Door 1 job needs you signed in as yourself, because the job
          is owned by your account. <a href="/admin/sign-in" className="underline underline-offset-4">Sign in with your email</a>.
        </p>
      </section>
    )
  }

  const db = supabaseAdmin()
  const [enquiryResult, voiceResult] = await Promise.all([
    db.from('enquiries').select('id, name, company, rel_status').order('created_at', { ascending: false }).limit(500),
    db
      .from('song_jobs')
      .select('pipeline_voice_model')
      .eq('delivery_profile', DOOR1)
      .not('pipeline_voice_model', 'is', null)
      .limit(500),
  ])

  // Signed artists first (the usual case), then everyone else, each newest first.
  const rows = enquiryResult.data ?? []
  const enquiries: EnquiryOption[] = [
    ...rows.filter((r) => r.rel_status === 'signed'),
    ...rows.filter((r) => r.rel_status !== 'signed'),
  ].map((r) => ({
    id: r.id,
    name: r.name,
    label: `${r.name}${r.company ? `, ${r.company}` : ''}${r.rel_status ? ` (${r.rel_status})` : ''}`,
    signed: r.rel_status === 'signed',
  }))

  const voices = [
    ...new Set(
      (voiceResult.data ?? [])
        .map((v) => v.pipeline_voice_model)
        .filter((v): v is string => Boolean(v)),
    ),
  ].sort()

  return (
    <section className={`${SHELL} py-16`}>
      <Door1Head
        title="New Door 1 job"
        lead="Queued straight to the render PC. No credits, no customer email, no watermark."
      />
      <Door1JobForm enquiries={enquiries} voices={voices} />
    </section>
  )
}
