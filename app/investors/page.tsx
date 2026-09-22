import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Mark } from '@/components/Mark'
import { Trademark } from '@/components/Trademark'
import { CapTable } from '@/components/sections/CapTable'
import InvestorMedia from '@/components/sections/InvestorMedia'
import { COMPS, INVESTORS, SECTIONS } from '@/content/investors'
import { INVESTOR_COOKIE, verifyInvestorSession } from '@/lib/investor-auth'
import { lock, unlock } from './actions'

/** Gated, noindex, disallowed in robots.ts, absent from the sitemap, linked from nowhere. */
export const metadata: Metadata = { title: 'Investors', robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

const field = 'w-full rounded-card border border-graphite/25 bg-transparent px-4 py-3 outline-none focus-visible:border-indigo'

function Gate({ error }: { error?: string }) {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-6 py-20">
      <div className="text-indigo"><Mark size={40} /></div>
      <h1 className="mt-8 font-brand text-4xl leading-tight tracking-tight">lyrical<Trademark /></h1>
      <p className="mt-4 max-w-sm leading-relaxed text-graphite/70">A private page for investors. If you were sent a password, it goes here.</p>
      <form action={unlock} className="mt-10 flex max-w-sm flex-col gap-4">
        <label className="flex flex-col gap-2"><span className="text-sm">Password</span><input name="password" type="password" required autoComplete="current-password" className={field} /></label>
        {error === '1' && <p role="alert" className="text-sm text-indigo">That password is not right.</p>}
        {error === 'rate' && <p role="alert" className="text-sm text-indigo">Too many attempts. Wait ten minutes and try again.</p>}
        <button type="submit" className="nudge inline-flex min-h-11 items-center self-start rounded-card bg-indigo px-6 text-cream">Open</button>
      </form>
    </section>
  )
}

export default async function Investors({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [jar, params] = await Promise.all([cookies(), searchParams])
  if (!verifyInvestorSession(jar.get(INVESTOR_COOKIE)?.value, Date.now())) return <Gate error={params.error} />
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
      <div className="flex items-start justify-between gap-6">
        <div className="text-indigo"><Mark size={32} /></div>
        <form action={lock}><button type="submit" className="inline-flex min-h-11 items-center text-sm text-graphite/50 underline underline-offset-4 hover:text-graphite">Lock</button></form>
      </div>
      <h1 className="mt-8 font-brand text-4xl leading-tight tracking-tight text-balance sm:text-5xl">{INVESTORS.title}</h1>
      <p className="mt-6 text-lg leading-relaxed text-graphite/75">{INVESTORS.frame}</p>
      {await InvestorMedia()}
      {SECTIONS.map((s) => (
        <section key={s.n} className="mt-16">
          <div className="flex items-baseline gap-4"><span className="font-mono text-xs tabular-nums text-indigo">{s.n}</span><h2 className="font-brand text-2xl leading-tight tracking-tight">{s.h}</h2></div>
          {s.p.map((p) => <p key={p.slice(0, 32)} className="mt-4 leading-relaxed text-graphite/75">{p}</p>)}
          {s.n === '03' && <div className="mt-6"><CapTable /></div>}
          {s.n === '06' && <p className="mt-4 rounded-card border border-graphite/20 px-4 py-3 text-sm text-graphite/70">{INVESTORS.placeholder}</p>}
        </section>
      ))}
      <section className="mt-16">
        <h2 className="font-brand text-2xl tracking-tight">Verified comps</h2>
        <table className="mt-6 w-full text-left text-sm"><tbody>
          {COMPS.map(([who, what]) => <tr key={who} className="border-b border-graphite/10"><th scope="row" className="py-3 pr-4 font-normal">{who}</th><td className="py-3">{what}</td></tr>)}
        </tbody></table>
      </section>
      <p className="mt-16 text-xs leading-relaxed text-graphite/45">Shared privately. Please do not forward this link.</p>
    </article>
  )
}
