import { NextResponse } from 'next/server'
import { hasAdminSession } from '@/lib/admin-session'
import { SUBMISSIONS_BUCKET } from '@/lib/song-upload'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Let a founder hear a submitted file, without a signed URL ever existing in a page.
 *
 * ## Why this is a redirect and not a link in the markup
 *
 * The obvious version signs every asset while rendering the queue and puts the URLs in the
 * HTML. That page would then hold live, working links to other people's unreleased masters:
 * in the browser cache, in the back-forward cache, in any screenshot, and in whatever a
 * misdirected share does with it. The URLs stay valid for their whole TTL no matter who ends
 * up holding them, because a signed URL carries its own authorization and asks nothing else.
 *
 * Here the page holds only an asset id, which is worthless on its own. The URL is minted at
 * the moment of the click, for somebody who has just proven they hold the admin session, and
 * it is never written down anywhere.
 *
 * ## The id is looked up, never trusted
 *
 * The caller passes an asset id and the PATH comes from the database. Taking a path from the
 * query string would make this a signing oracle for any object in the bucket, which is every
 * customer's every master, gated only by knowing a path shape that is documented in this repo.
 *
 * ## Ten minutes
 *
 * Long enough to listen to a song, short enough that a URL which escapes is dead before it is
 * useful. Deliberately shorter than the `/listen` TTL, which matches a session because a
 * listener may leave a tab open mid-meeting. Nobody is browsing this page for four hours.
 */
const SIGNED_URL_TTL_S = 600

export async function GET(request: Request) {
  // 404 rather than 401 or 403: an unauthenticated caller learns nothing about what is here,
  // including whether the id they guessed exists.
  if (!(await hasAdminSession())) return new Response('Not found', { status: 404 })

  const id = new URL(request.url).searchParams.get('asset') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 })

  const db = supabaseAdmin()

  const { data: asset, error } = await db
    .from('song_job_assets')
    .select('path')
    .eq('id', id)
    .maybeSingle()

  if (error || !asset?.path) return new Response('Not found', { status: 404 })

  const { data: signed, error: signError } = await db.storage
    .from(SUBMISSIONS_BUCKET)
    .createSignedUrl(asset.path, SIGNED_URL_TTL_S)

  if (signError || !signed?.signedUrl) {
    console.error('[queue] could not sign a submission', signError)
    return new Response('That file could not be opened.', { status: 502 })
  }

  return NextResponse.redirect(signed.signedUrl, {
    // The redirect itself carries the signed URL in a Location header, so it must not be
    // stored by anything on the way back to the browser.
    headers: { 'cache-control': 'no-store, private' },
  })
}
