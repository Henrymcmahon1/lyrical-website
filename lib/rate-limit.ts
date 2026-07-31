/**
 * A fixed-window rate limiter, held in memory.
 *
 * HONEST LIMITATION, stated up front: this is per serverless instance. Vercel may run several
 * concurrently and each keeps its own counter, so the true ceiling is roughly the limit
 * multiplied by the number of warm instances, and a cold start forgets everything. It is not a
 * hard guarantee and must not be relied on as one.
 *
 * It is still worth having. The attack it exists to make expensive is guessing a single shared
 * password on /leads, where unlimited attempts is the difference between a passphrase being
 * strong enough and not mattering at all. Turning thousands of guesses per second into a few
 * per minute per instance changes that problem completely. A distributed limiter backed by
 * Redis or Upstash is the upgrade if this ever needs to be a guarantee.
 */

type Bucket = { count: number; windowStart: number }

const buckets = new Map<string, Bucket>()

/** Beyond this many tracked keys, prune aggressively rather than grow. */
const MAX_KEYS = 5000

export type LimitResult = {
  allowed: boolean
  /** How many more requests this key may make in the current window. */
  remaining: number
  /** Milliseconds until the window resets. Zero when allowed. */
  retryAfterMs: number
  /** Exposed for tests, to assert the store cannot grow without bound. */
  trackedKeys: number
}

/**
 * Drop every bucket whose window has closed.
 *
 * Without this, one request per unique (and trivially spoofable) IP is an unbounded memory
 * leak, which would turn the rate limiter into a denial-of-service vector against ourselves.
 */
function prune(now: number, windowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= windowMs) buckets.delete(key)
  }
}

/**
 * Record one request against `key` and say whether it is allowed.
 *
 * `now` is a parameter rather than a call to `Date.now()` so the behaviour is testable
 * without faking timers, and so a caller cannot accidentally get two different clocks.
 */
export function consume(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): LimitResult {
  if (buckets.size > MAX_KEYS) prune(now, windowMs)

  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart >= windowMs) {
    // Opportunistic prune on window rollover: cheap, and keeps idle keys from lingering.
    if (buckets.size > 64) prune(now, windowMs)
    buckets.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0, trackedKeys: buckets.size }
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: bucket.windowStart + windowMs - now,
      trackedKeys: buckets.size,
    }
  }

  bucket.count += 1
  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfterMs: 0,
    trackedKeys: buckets.size,
  }
}

/** Test helper. Never called by application code. */
export function resetAllLimits(): void {
  buckets.clear()
}

/**
 * The client IP, as far as it can be known behind Vercel's proxy.
 *
 * `x-forwarded-for` is client-controlled in general, but Vercel overwrites it at the edge, so
 * the LEFT-most entry is the real client here. Falls back to a constant, which means an
 * unknown-IP caller shares one bucket with every other unknown-IP caller. That is the safe
 * direction to fail: it throttles harder, never softer.
 */
export function clientKey(headers: Headers, scope: string): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || headers.get('x-real-ip')?.trim() || 'unknown'
  return `${scope}:${ip}`
}
