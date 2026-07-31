import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifyAdminSession } from './admin-auth'

/**
 * Read and verify the admin session from the request's cookies.
 *
 * One place that knows how the session is read, used by the page, the export route and the
 * server actions alike. Each of those is independently reachable, so each has to check, and
 * they must not check in three subtly different ways.
 *
 * It also keeps the clock read out of a component body: calling `Date.now()` during render
 * is impure, and React's lint rules correctly object to it.
 */
export async function hasAdminSession(): Promise<boolean> {
  const jar = await cookies()
  return verifyAdminSession(jar.get(ADMIN_COOKIE)?.value, Date.now())
}
