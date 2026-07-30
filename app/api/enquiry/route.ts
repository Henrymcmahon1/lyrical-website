import { Resend } from 'resend'
import { EnquirySchema, MIN_ELAPSED_MS } from '@/lib/enquiry-schema'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { GATE_COOKIE, signGate } from '@/lib/gate'

export const runtime = 'nodejs'

const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extra },
  })

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''
  const isFormPost = !contentType.includes('application/json')

  let raw: unknown
  if (isFormPost) {
    // No-JS path: a native <form method="post"> submission.
    const fd = await request.formData()
    raw = {
      ...Object.fromEntries(fd.entries()),
      target_languages: fd.getAll('target_languages').map(String),
      elapsed_ms: Number(fd.get('elapsed_ms') ?? MIN_ELAPSED_MS),
      unlocked_audio: fd.get('source') === 'gate',
    }
  } else {
    raw = await request.json().catch(() => null)
  }

  const parsed = EnquirySchema.safeParse(raw)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid submission'
    if (isFormPost) return Response.redirect(new URL('/?enquiry=error', request.url), 303)
    return json({ error: message }, 400)
  }
  const d = parsed.data

  // Anti-spam: look successful to the bot, write nothing.
  if (d.website || d.elapsed_ms < MIN_ELAPSED_MS) {
    if (isFormPost) return Response.redirect(new URL('/?enquiry=sent', request.url), 303)
    return json({ ok: true }, 200)
  }

  const { error } = await supabaseAdmin()
    .from('enquiries')
    .insert({
      name: d.name,
      email: d.email,
      role: d.role,
      company: d.company || null,
      catalogue_size: d.catalogue_size || null,
      target_languages: d.target_languages?.length ? d.target_languages : null,
      message: d.message || null,
      source: d.source,
      unlocked_audio: d.unlocked_audio,
      user_agent: request.headers.get('user-agent'),
      referrer: request.headers.get('referer'),
    })

  if (error) {
    console.error('[enquiry] supabase insert failed', error)
    if (isFormPost) return Response.redirect(new URL('/?enquiry=error', request.url), 303)
    return json({ error: 'We could not save that. Please try again.' }, 500)
  }

  // The lead is safe in the database. An email failure must NEVER surface to the visitor
  // or cost us the enquiry — log it and carry on.
  try {
    const apiKey = process.env.RESEND_API_KEY
    const to = process.env.ENQUIRY_TO_EMAIL
    const from = process.env.ENQUIRY_FROM_EMAIL
    if (apiKey && to && from) {
      await new Resend(apiKey).emails.send({
        from,
        to,
        replyTo: d.email,
        subject: `Lyrical enquiry — ${d.name} (${d.role})`,
        text: [
          `Name:      ${d.name}`,
          `Email:     ${d.email}`,
          `Role:      ${d.role}`,
          `Company:   ${d.company || '-'}`,
          `Songs:     ${d.catalogue_size || '-'}`,
          `Languages: ${d.target_languages?.join(', ') || '-'}`,
          `Source:    ${d.source}`,
          `Unlocked:  ${d.unlocked_audio}`,
          '',
          'Message:',
          d.message || '(none)',
        ].join('\n'),
      })
    } else {
      console.warn('[enquiry] Resend not configured; row written, no email sent')
    }
  } catch (e) {
    console.error('[enquiry] resend send failed — the row was still written', e)
  }

  const extra: Record<string, string> = {}
  if (d.unlocked_audio) {
    try {
      extra['set-cookie'] =
        `${GATE_COOKIE}=${signGate(d.email)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000` +
        (process.env.NODE_ENV === 'production' ? '; Secure' : '')
    } catch (e) {
      console.error('[enquiry] could not sign gate cookie', e)
    }
  }

  if (isFormPost) {
    return new Response(null, {
      status: 303,
      headers: { location: new URL('/?enquiry=sent', request.url).toString(), ...extra },
    })
  }
  return json({ ok: true }, 200, extra)
}
