import { NextResponse } from 'next/server'
import { signDelivery } from '@/lib/deliveries'
import { currentUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Stream a customer their own finished cover, without a signed URL ever living in a page.
 *
 * The `<audio>` element in `/studio` points here with a delivery id. On the click this verifies
 * the signed-in user owns that delivery, mints a short-lived signed URL, and redirects to it with
 * `no-store` so nothing on the way back to the browser keeps it. A 404 (not 401/403) for a caller
 * who is not signed in or does not own the id, so a guessed id reveals nothing about what exists.
 *
 * Same rule as the whole site: never a signed URL in an email; this route is the only way a cover
 * is fetched, and only after the ownership check.
 */
export async function GET(request: Request) {
  const user = await currentUser()
  if (!user) return new Response('Not found', { status: 404 })

  const id = new URL(request.url).searchParams.get('delivery') ?? ''
  const url = await signDelivery(user.id, id)
  if (!url) return new Response('Not found', { status: 404 })

  return NextResponse.redirect(url, {
    headers: { 'cache-control': 'no-store, private' },
  })
}
