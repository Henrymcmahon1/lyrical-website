/**
 * The shared-secret gate both `app/api/hooks/**` routes use. One place, so the rule "fail loud
 * (503) only on a missing shared secret in production" cannot drift between them.
 *
 * A missing secret in production is a real misconfiguration and refuses every request. Outside
 * production, where a secret is often not set up yet, a missing secret is accepted rather than
 * blocking local development and CI. A PRESENT secret, once configured, is always enforced,
 * in every environment.
 */

export type SecretGateResult = { ok: true } | { ok: false; status: number; body: string }

function gate(configured: string | undefined, matches: boolean, envVarName: string): SecretGateResult {
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, status: 503, body: `${envVarName} must be set` }
    }
    return { ok: true }
  }
  return matches ? { ok: true } : { ok: false, status: 401, body: 'bad secret' }
}

/** A raw header value compared directly to the env var, e.g. `x-hook-secret`. */
export function requireSharedSecret(provided: string | null, envVarName: string): SecretGateResult {
  const expected = process.env[envVarName]
  return gate(expected, provided === expected, envVarName)
}

/** Vercel Cron's `Authorization: Bearer <CRON_SECRET>` convention. */
export function requireBearerSecret(authorizationHeader: string | null, envVarName: string): SecretGateResult {
  const expected = process.env[envVarName]
  const token = authorizationHeader?.startsWith('Bearer ') ? authorizationHeader.slice(7) : null
  return gate(expected, token !== null && token === expected, envVarName)
}
