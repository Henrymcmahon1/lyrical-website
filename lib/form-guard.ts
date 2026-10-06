import { callerIp, turnstileTokenFrom, verifyTurnstile, type TurnstileAction } from './turnstile'

/**
 * The server half of `components/FormGuard.tsx`, for plain server-action forms (issue #392).
 *
 * Checks, in order: the honeypot, then Turnstile (which fails closed, see `lib/turnstile.ts`).
 * Returns a short code the page turns into plain words via `?error=`:
 *
 *   bot    the honeypot was filled, or the challenge failed. Deliberately the same code, so a
 *          bot learns nothing about which check caught it.
 *   check  Cloudflare could not be reached. Not the person's fault; try again shortly.
 *   off    production with no Turnstile secret. Logged loudly by the verifier.
 */
export type GuardCode = 'bot' | 'check' | 'off'
export type GuardResult = { ok: true } | { ok: false; code: GuardCode }

export async function guardForm(formData: FormData, action: TurnstileAction, headers: Headers): Promise<GuardResult> {
  if (String(formData.get('website') ?? '') !== '') return { ok: false, code: 'bot' }
  const r = await verifyTurnstile(turnstileTokenFrom(formData), { action, remoteip: callerIp(headers) })
  if (r.ok) return { ok: true }
  if (r.reason === 'error') return { ok: false, code: 'check' }
  if (r.reason === 'unconfigured') return { ok: false, code: 'off' }
  return { ok: false, code: 'bot' }
}

/** The words for each code, shared by every page that shows one. */
export const GUARD_MESSAGES: Record<GuardCode, string> = {
  bot: 'That did not look human. Refresh the page and try again.',
  check: 'We could not check that just now. Please try again in a minute.',
  off: 'This form is not available right now. Please try again later.',
}

export function isGuardCode(v: unknown): v is GuardCode {
  return v === 'bot' || v === 'check' || v === 'off'
}
