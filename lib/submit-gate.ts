import { quotaStatus } from '@/lib/quota'

/**
 * The website half of the two-sided gate: may this user start a cover right now?
 * The pipeline service layer re-checks the same thing before it spends, so this
 * is the fast, friendly refusal, not the only one.
 */
export async function assertEntitled(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const q = await quotaStatus(userId)
  if (q.entitled) return { ok: true }
  return {
    ok: false,
    error:
      'You have used all your covers for this period, or your subscription is not active. Visit pricing to continue.',
  }
}
