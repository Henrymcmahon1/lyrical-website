import { WaveMark } from '@/components/studio/WaveMark'
import { StudioNav } from '@/components/studio/StudioNav'
import { SignOutIcon } from '@/components/studio/NavIcons'
import { currentUser, supabaseServer } from '@/lib/supabase-server'
import { signOut } from './actions'
import './studio.css'

/**
 * The studio shell: the signed-in product wears the same frame as the staff control room
 * (lyrical-studio `AppShell.tsx` and `Sidebar.tsx`). One bordered rack panel on the dark
 * ground, the rail on the left with the wave mark and the tabs, the page on the right.
 *
 * Applies to every route under /studio. The sign-in page lives at
 * `app/(public)/studio/sign-in` so it keeps the public chrome; `components/SiteChrome.tsx`
 * drops the site Nav and Footer on the routes drawn here.
 *
 * The mark ripples while one of this customer's songs is still being made, the same global
 * "something is happening" signal the dashboard wires to `useActivity()`. Read with the user's
 * own client so RLS scopes it, one row is enough, and a visitor without a session (the pages
 * redirect them) costs no query at all.
 */
async function somethingRendering(): Promise<boolean> {
  const user = await currentUser()
  if (!user) return false
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('song_jobs')
    .select('id')
    .not('status', 'in', '(delivered,rejected)')
    .limit(1)
  return (data?.length ?? 0) > 0
}

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const active = await somethingRendering()

  return (
    <div className="studio-shell flex min-h-screen flex-1 flex-col bg-dark-ground font-product text-dark-ink">
      <div className="m-3 flex min-h-[calc(100vh-1.5rem)] flex-col rounded-card border border-dark-ink/10 sm:m-6 sm:min-h-[calc(100vh-3rem)] sm:flex-row">
        <aside className="studio-rail bg-dark-ground">
          <div className="studio-rail-head">
            <a href="/studio" className="inline-flex min-h-11 items-center gap-3" aria-label="lyrical studio, your songs">
              <WaveMark active={active} tone="accent" />
              <span className="font-brand text-lg leading-none tracking-tight text-dark-ink">lyrical studio</span>
            </a>
            <form action={signOut} className="studio-signout sm:hidden">
              <button type="submit" className="studio-tab text-dark-ink/45 hover:text-dark-ink/70">
                <SignOutIcon className="h-[18px] w-[18px] shrink-0" />
                <span>Sign out</span>
              </button>
            </form>
          </div>

          <StudioNav />

          <form action={signOut} className="studio-signout hidden sm:block">
            <button type="submit" className="studio-tab w-full text-dark-ink/45 hover:text-dark-ink/70">
              <SignOutIcon className="h-[18px] w-[18px] shrink-0" />
              <span>Sign out</span>
            </button>
          </form>
        </aside>

        <main id="main" className="min-w-0 flex-1 p-5 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
