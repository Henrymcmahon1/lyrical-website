import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Signing a finished cover for the customer who owns it.
 *
 * Modelled on `app/queue/audio/route.ts`: the page holds only a delivery id, which is worthless
 * on its own; the URL is minted at the moment of the click and never written into any markup,
 * cache, or email. The difference here is who is allowed: not a staff session, but the customer
 * whose row it is.
 *
 * The ownership check is explicit (`.eq('user_id', userId)`) rather than left to RLS, because
 * this uses the service-role client to sign (storage signing is a server job) and the service
 * role bypasses every policy. Taking the path from the query string instead of the database
 * would make this a signing oracle for every customer's every cover, so the path is looked up,
 * never trusted.
 */
export const DELIVERIES_BUCKET = 'deliveries'

// Long enough to play a song, short enough that a URL which escapes is dead before it is useful.
const SIGNED_URL_TTL_S = 600

export async function signDelivery(
  userId: string,
  deliveryId: string,
): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(deliveryId)) return null

  const db = supabaseAdmin()

  const { data: row, error } = await db
    .from('song_job_deliveries')
    .select('path')
    .eq('id', deliveryId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !row?.path) return null

  const { data: signed, error: signError } = await db.storage
    .from(DELIVERIES_BUCKET)
    .createSignedUrl(row.path, SIGNED_URL_TTL_S)

  if (signError || !signed?.signedUrl) {
    console.error('[studio] could not sign a delivery', signError)
    return null
  }

  return signed.signedUrl
}
