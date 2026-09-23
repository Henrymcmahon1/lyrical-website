import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-session'
import { DOOR1, DOOR1_BUCKET, DOOR1_SIGNED_URL_TTL_S } from '@/lib/door1-schema'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Download one delivered Door 1 stem (24-bit FLAC) from the private `door1` bucket.
 *
 * Same pattern as `/admin/audio`: the page holds only a delivery id, and the signed URL is
 * minted here at the moment of the click, after `requireAdmin()`, and never written into a
 * page. Sixty seconds: long enough to start a download, dead before an escaped link is useful.
 *
 * Read-only, so a break-glass session may use it. The PATH comes from the database, never the
 * query string, and only for a delivery of a Door 1 job whose path sits in that job's folder
 * (`{job_id}/{kind}.flac`), so this can never sign a Door 2 file or anything else.
 */
const notFound = () => new Response('Not found', { status: 404 })

export async function GET(request: Request) {
  if (!(await requireAdmin()).ok) return notFound()

  const id = new URL(request.url).searchParams.get('delivery') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound()

  const db = supabaseAdmin()
  const { data: delivery, error } = await db
    .from('song_job_deliveries')
    .select('job_id, path, filename, purged_at')
    .eq('id', id)
    .maybeSingle()
  if (error || !delivery?.path) return notFound()

  const { data: job, error: jobError } = await db
    .from('song_jobs')
    .select('id, delivery_profile, title')
    .eq('id', delivery.job_id)
    .maybeSingle()
  if (jobError || !job || job.delivery_profile !== DOOR1) return notFound()
  if (!String(delivery.path).startsWith(`${job.id}/`) || String(delivery.path).includes('..')) return notFound()

  if (delivery.purged_at) {
    return new Response(
      'This file was purged 7 days after delivery. The 24-bit WAV masters are on the render PC.',
      { status: 410 },
    )
  }

  // A readable file name for the save dialog: "<title> - <kind>.flac", safe characters only.
  const base = `${job.title ?? 'door1'} - ${delivery.filename ?? 'stem.flac'}`
  const download = base.replace(/[^\w .()-]+/g, '_').slice(0, 150)

  const { data: signed, error: signError } = await db.storage
    .from(DOOR1_BUCKET)
    .createSignedUrl(delivery.path, DOOR1_SIGNED_URL_TTL_S, { download })
  if (signError || !signed?.signedUrl) {
    console.error('[door1] could not sign a delivery', signError)
    return new Response('That file could not be opened.', { status: 502 })
  }

  return NextResponse.redirect(signed.signedUrl, {
    headers: { 'cache-control': 'no-store, private' },
  })
}
