import { NextResponse } from 'next/server'
import { sendDeliveredEmail } from '@/lib/delivery-notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Fire the "it's ready" email when a job becomes delivered.
 *
 * The pipeline delivers by writing `status='delivered'` straight to the database (a service-role
 * write, not a `/queue` button), so the founder email path never runs. A Supabase Database
 * Webhook on `song_jobs` UPDATE calls this route, which sends the same delivered email once, on
 * the transition INTO delivered.
 *
 * Gated by a shared secret (`DELIVERY_WEBHOOK_SECRET`, set in Vercel and in the webhook's header
 * at deploy time). A wrong or missing secret gets a 404, revealing nothing. No signed URL or file
 * ever appears in the email; that rule is enforced in `lib/song-job-email.ts` and its leak test.
 */
export async function POST(request: Request) {
  const secret = process.env.DELIVERY_WEBHOOK_SECRET
  if (!secret || request.headers.get('x-delivery-secret') !== secret) {
    return new Response('Not found', { status: 404 })
  }

  let payload: {
    table?: string
    record?: Record<string, unknown>
    old_record?: Record<string, unknown> | null
  }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 })
  }

  const { table, record, old_record } = payload ?? {}

  // Only the transition INTO delivered, and only once: an update that leaves it already
  // delivered, or touches any other table/column, must not re-email.
  if (
    table !== 'song_jobs' ||
    record?.status !== 'delivered' ||
    old_record?.status === 'delivered'
  ) {
    return NextResponse.json({ ok: true, sent: false })
  }

  const sent = await sendDeliveredEmail({
    title: String(record.title ?? ''),
    primary_artist: String(record.primary_artist ?? ''),
    source_language: String(record.source_language ?? ''),
    target_language: String(record.target_language ?? ''),
    user_id: String(record.user_id ?? ''),
  })

  return NextResponse.json({ ok: true, sent })
}
