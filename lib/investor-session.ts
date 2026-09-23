import { cookies } from 'next/headers'
import { INVESTOR_COOKIE, verifyInvestorSession } from './investor-auth'

/**
 * Read and verify the /investors session from the request's cookies.
 *
 * Mirrors `demo-session` and `admin-session`: one place that knows how this session is read, and
 * the clock read stays out of the component body (`Date.now()` during render is impure, and
 * React's lint rules correctly object to it).
 */
export async function hasInvestorSession(): Promise<boolean> {
  const jar = await cookies()
  return verifyInvestorSession(jar.get(INVESTOR_COOKIE)?.value, Date.now())
}
