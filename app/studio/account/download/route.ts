import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { exportAccountData } from '@/lib/account-data'

/**
 * "Download my data": every row this account owns, as one JSON file. Privileged (service
 * role), scoped to the signed-in caller by `lib/account-data.ts`'s exportAccountData, which
 * never touches another user's rows.
 */
export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  const data = await exportAccountData(supabaseAdmin(), user.id)
  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="lyrical-my-data.json"',
    },
  })
}
