import { redirect } from 'next/navigation'
import { SignInForm } from '@/components/SignInForm'
import { currentUser } from '@/lib/supabase-server'

/**
 * Sign in to the studio.
 *
 * `noindex`: this is a working page for customers, not a page for search. It also has nothing
 * on it a crawler could use, and a sign in form in the index is a small invitation to
 * credential-stuffing traffic we would rather not receive.
 */
export const metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
}

export default async function SignIn({
  searchParams,
}: {
  // Async-only as of Next.js 16.
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const [user, params] = await Promise.all([currentUser(), searchParams])

  // Already signed in: nobody wants to be asked to sign in again.
  if (user) redirect(params.next && params.next.startsWith('/') ? params.next : '/studio')

  const ERRORS: Record<string, string> = {
    link: 'That link has expired or was already used. Here is a fresh one.',
    missing: 'That link was incomplete. Enter your email and we will send another.',
  }
  const notice = params.error ? ERRORS[params.error] : undefined

  return (
    <section className="mx-auto max-w-md px-6 py-24 sm:py-28">
      <span className="font-mono text-xs tracking-[0.18em] text-graphite/45">The studio</span>
      <h1 className="mt-5 font-brand text-4xl leading-[1.1] tracking-tight text-balance">
        Sign in to make your song multilingual.
      </h1>

      {notice && (
        <p role="status" className="mt-6 leading-relaxed text-graphite/75">
          {notice}
        </p>
      )}

      <div className="mt-10">
        <SignInForm next={params.next} />
      </div>
    </section>
  )
}
