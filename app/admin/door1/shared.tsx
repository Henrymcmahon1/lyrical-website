import Link from 'next/link'
import { redirect } from 'next/navigation'
import { breakGlassEnabled } from '@/lib/admin-identity'
import type { AdminCheck } from '@/lib/admin-session'
import { languageByCode } from '@/lib/languages'
import { MfaRequired, NotAuthorized } from '../Refused'

/**
 * Shared bits for the Door 1 pages. Server-only (no 'use client'): nothing here is ever passed
 * to a client component as a function prop.
 */

export const SHELL = 'mx-auto w-full max-w-4xl px-6'

/**
 * What a Door 1 page draws for a refused `requireAdmin()`, exactly as `/admin` does: a signed-in
 * non-admin sees "Not authorized", an allowlisted user short of AAL2 sees the MFA notice, and a
 * signed-out visitor is sent to sign in (to `/admin`, where the break-glass form lives, only
 * while break-glass is on). Returns null for an admin.
 */
export function refusedView(admin: AdminCheck): React.ReactElement | null {
  if (admin.ok) return null
  if (admin.reason === 'not-allowlisted') return <NotAuthorized />
  if (admin.reason === 'mfa-required') return <MfaRequired />
  redirect(breakGlassEnabled() ? '/admin' : '/admin/sign-in')
}

export const languageName = (code: string) => languageByCode(code)?.english ?? code

export function when(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Australia/Melbourne',
  })
}

export function day(date: string | null | undefined): string {
  if (!date) return ''
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 ** 2)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** The small header every Door 1 page shares: back to the console, and the Door 1 home. */
export function Door1Head({ title, lead }: { title: string; lead?: React.ReactNode }) {
  return (
    <div>
      <nav aria-label="Door 1" className="flex flex-wrap gap-x-6 font-mono text-[11px] uppercase tracking-[0.16em]">
        <a href="/admin" className="text-graphite/45 hover:text-indigo">
          Admin
        </a>
        <Link href="/admin/door1" className="text-graphite/45 hover:text-indigo">
          Door 1 jobs
        </Link>
        <Link href="/admin/door1/new" className="text-graphite/45 hover:text-indigo">
          New job
        </Link>
      </nav>
      <h1 className="mt-6 font-brand text-4xl tracking-tight">{title}</h1>
      {lead && <p className="mt-3 max-w-2xl text-graphite/70">{lead}</p>}
    </div>
  )
}
