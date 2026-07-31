import { hasAdminSession } from '@/lib/admin-session'
import { toCsv } from '@/lib/csv'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COLUMNS = [
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
 * CSV of every enquiry.
 *
 * The session is verified here independently of the page. This is a plain GET that returns
 * personal data, so guarding only the page that links to it would guard nothing.
 */
export async function GET() {
  if (!(await hasAdminSession())) {
    // 404 rather than 401: an unauthenticated caller learns nothing about what is here.
    return new Response('Not found', { status: 404 })
  }

  const { data, error } = await supabaseAdmin()
    .from('enquiries')
    .select(COLUMNS.join(','))
    .order('created_at', { ascending: false })

  if (error) {
    return new Response(`Could not read enquiries: ${error.message}`, { status: 500 })
  }

  const stamp = new Date().toISOString().slice(0, 10)

  return new Response(toCsv(COLUMNS, (data ?? []) as unknown as Record<string, unknown>[]), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="lyrical-enquiries-${stamp}.csv"`,
      // Personal data. Never store it in a shared cache.
      'cache-control': 'no-store, private',
    },
  })
}
