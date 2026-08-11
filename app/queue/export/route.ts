import { hasAdminSession } from '@/lib/admin-session'
import { toCsv } from '@/lib/csv'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * CSV of whichever tab asked for it.
 *
 * The session is verified here independently of the page. This is a plain GET that returns
 * personal data, so guarding only the page that links to it would guard nothing.
 *
 * `toCsv` is what defuses spreadsheet formula injection: a cell beginning `=`, `+`, `-` or `@`
 * is executed on open by Excel, Numbers and Sheets alike, and every value here was typed by a
 * stranger. That protection is the reason this route was moved across intact rather than
 * rewritten alongside the new tab.
 */

const ENQUIRY_COLUMNS = [
  'created_at',
  'name',
  'email',
  'role',
  'company',
  'catalogue_size',
  'target_languages',
  'message',
  'source',
  'unlocked_audio',
  'handled',
  'handled_at',
]

/**
 * Songs, WITHOUT storage paths.
 *
 * A CSV leaves the building: it lands in a downloads folder, gets mailed around and opens in a
 * spreadsheet nobody controls. Object keys are the one thing here that is useful to somebody
 * who should not have it, and they are not needed to reason about a pipeline. The title,
 * artist, pair, state and timestamps are.
 */
const SONG_COLUMNS = [
  'created_at',
  'title',
  'primary_artist',
  'source_language',
  'target_language',
  'status',
  'approved_at',
  'delivered_at',
  'rights_warranted_at',
  'notes',
]

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    // 404 rather than 401: an unauthenticated caller learns nothing about what is here.
    return new Response('Not found', { status: 404 })
  }

  const songs = new URL(request.url).searchParams.get('tab') !== 'enquiries'
  const table = songs ? 'song_jobs' : 'enquiries'
  const columns = songs ? SONG_COLUMNS : ENQUIRY_COLUMNS

  const { data, error } = await supabaseAdmin()
    .from(table)
    .select(columns.join(','))
    .order('created_at', { ascending: false })

  if (error) {
    return new Response(`Could not read ${table}: ${error.message}`, { status: 500 })
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const name = songs ? 'songs' : 'enquiries'

  return new Response(toCsv(columns, (data ?? []) as unknown as Record<string, unknown>[]), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="lyrical-${name}-${stamp}.csv"`,
      // Personal data. Never store it in a shared cache.
      'cache-control': 'no-store, private',
    },
  })
}
