import { POST as enquiryPost } from '@/app/api/enquiry/route'
import { EoiSchema, toEnquiry } from '@/lib/eoi-schema'

export const runtime = 'nodejs'

/**
 * The no-JavaScript path for the artist EOI form.
 *
 * With JavaScript the form maps its answers with `toEnquiry` in the browser and posts JSON to
 * /api/enquiry. Without it the browser posts here natively; this route does the same mapping
 * on the server, re-posts as the multipart form the enquiry route already accepts (honeypot,
 * elapsed-time floor, rate limit, storage and email all reused, untouched), then sends the
 * visitor back to /artists with a state the page renders. Headers are forwarded so
 * `clientKey` sees the real IP. A filled honeypot fails `website: z.literal('')` in the
 * enquiry schema, so it comes back as `enquiry=error` and nothing is written.
 */
const FORWARD = ['x-forwarded-for', 'x-real-ip', 'user-agent', 'referer'] as const

export async function POST(request: Request) {
  const back = (state: 'sent' | 'error') =>
    new Response(null, {
      status: 303,
      headers: { location: new URL(`/artists?eoi=${state}#eoi`, request.url).toString() },
    })

  const fd = await request.formData()
  const parsed = EoiSchema.safeParse({
    ...Object.fromEntries(fd.entries()),
    target_languages: fd.getAll('target_languages').map(String),
  })
  if (!parsed.success) return back('error')

  const m = toEnquiry(parsed.data)
  const out = new FormData()
  const plain = {
    name: m.name,
    email: m.email,
    role: m.role,
    company: m.company,
    catalogue_size: m.catalogue_size,
    message: m.message,
    source: m.source,
  }
  for (const [k, v] of Object.entries(plain)) out.set(k, v)
  for (const code of m.target_languages) out.append('target_languages', code)
  out.set('elapsed_ms', String(fd.get('elapsed_ms') ?? ''))
  out.set('website', String(fd.get('website') ?? ''))

  const headers = new Headers()
  for (const h of FORWARD) {
    const v = request.headers.get(h)
    if (v) headers.set(h, v)
  }

  const res = await enquiryPost(
    new Request(new URL('/api/enquiry', request.url), { method: 'POST', body: out, headers }),
  )
  const location = res.headers.get('location') ?? ''
  return back(res.status === 303 && location.includes('enquiry=sent') ? 'sent' : 'error')
}
