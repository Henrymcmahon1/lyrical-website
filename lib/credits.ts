import type { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * The song_credits ledger. Append only: a Single purchase is +1, a submit that spends it is -1,
 * a refund or staff grant is +1. The balance is the sum, never a stored counter, so a replayed
 * webhook (blocked by stripe_event_id unique) or a crashed submit cannot leave a wrong number.
 * Only the service role writes here; customers have no insert policy.
 */
type Admin = ReturnType<typeof supabaseAdmin>

export type CreditReason = 'purchase_single' | 'refund' | 'grant'

export async function creditBalance(admin: Admin, userId: string): Promise<number> {
  const { data, error } = await admin.from('song_credits').select('delta').eq('user_id', userId)
  if (error) throw new Error(error.message)
  return (data ?? []).reduce((sum, row) => sum + (row.delta as number), 0)
}

export async function addCredit(
  admin: Admin,
  args: { userId: string; reason: CreditReason; stripeEventId: string | null },
): Promise<void> {
  const { error } = await admin
    .from('song_credits')
    .insert({ user_id: args.userId, delta: 1, reason: args.reason, stripe_event_id: args.stripeEventId })
  if (error) throw new Error(error.message)
}

/** Returns false instead of throwing: the caller must delete the job it just inserted. */
export async function consumeCredit(admin: Admin, args: { userId: string; jobId: string }): Promise<boolean> {
  const { error } = await admin
    .from('song_credits')
    .insert({ user_id: args.userId, delta: -1, reason: 'consume', job_id: args.jobId })
  return !error
}
