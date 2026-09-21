import { CAP_ROWS } from '@/content/two-doors'

/** Capped (self-serve) against unlocked (signed artist). One table, reused on /pricing and /investors. */
export function CapTable() {
  const th = 'py-3 pr-4 font-normal'
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-graphite/20 font-mono text-[11px] uppercase tracking-[0.16em] text-graphite/50">
          <th className={th}>What</th><th className={th}>Self-serve</th><th className="py-3 font-normal">Signed artist</th>
        </tr>
      </thead>
      <tbody>
        {CAP_ROWS.map((r) => (
          <tr key={r.what} className="border-b border-graphite/10">
            <th scope="row" className={`${th} text-graphite/70`}>{r.what}</th><td className="py-3 pr-4">{r.capped}</td><td className="py-3">{r.unlocked}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
