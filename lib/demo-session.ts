import { cookies } from 'next/headers'
import { DEMO_COOKIE, verifyDemoSession } from './demo-auth'

/**
 * Read and verify the /listen session from the request's cookies.
 *
 * One place that knows how this session is read, mirroring `admin-session`. The page and the
 * server actions are each independently reachable, so each has to check, and they must not
 * check in two subtly different ways.
 *
 * It also keeps the clock read out of a component body: calling `Date.now()` during render is
 * impure and React's lint rules correctly object to it.
 */
export async function hasDemoSession(): Promise<boolean> {
  const jar = await cookies()
  return verifyDemoSession(jar.get(DEMO_COOKIE)?.value, Date.now())
}
