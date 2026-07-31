import { Resend } from 'resend'
import {
  canEmailStrangers,
  confirmationHtml,
  confirmationSubject,
  confirmationText,
  enquiryEmailHtml,
  enquiryEmailSubject,
  enquiryEmailText,
} from '@/lib/enquiry-email'
import { EnquirySchema, MIN_ELAPSED_MS, resolveName } from '@/lib/enquiry-schema'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { GATE_COOKIE, signGate } from '@/lib/gate'
import { clientKey, consume } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extra },
  })

/** Enough for a person who mis-typed their email twice. Not enough to flood the inbox. */
const ENQUIRY_LIMIT = 5
const ENQUIRY_WINDOW_MS = 10 * 60 * 1000

export async function POST(request: Request) {
  /**
   * The honeypot and the elapsed-time check already catch naive bots, but neither stops
   * somebody deliberately POSTing this endpoint in a loop. Every submission costs a database
   * row and two emails, so the cost of abuse is real.
   */
  const limit = consume(
    clientKey(request.headers, 'enquiry'),
    ENQUIRY_LIMIT,
    ENQUIRY_WINDOW_MS,
    Date.now(),
  )
  if (!limit.allowed) {
    const retry = Math.ceil(limit.retryAfterMs / 1000)
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return Response.redirect(new URL('/?enquiry=error', request.url), 303)
    }
    return json(
      { error: 'That is a lot of enquiries in a short time. Please try again shortly.' },
      429,
      { 'retry-after': String(retry) },
    )
  }

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

  /**
   * The examples gate does not ask for a name, but the column is NOT NULL and an email
   * addressed to nobody reads badly. One resolved value, used for the row and the email,
   * so the two can never disagree about who this was.
   */
  const record = { ...d, name: resolveName(d) }

  // Anti-spam: look successful to the bot, write nothing.
  if (d.website || d.elapsed_ms < MIN_ELAPSED_MS) {
    if (isFormPost) return Response.redirect(new URL('/?enquiry=sent', request.url), 303)
    return json({ ok: true }, 200)
  }

  /**
   * Storage is optional at runtime.
   *
   * The site can be deployed before Supabase exists, and a hard failure there would show
   * a live visitor a broken form. If storage is not configured we carry on to the email,
   * which is enough to not lose the lead. Only a configured-but-failing database is a
   * real 500, because that is a fault rather than a missing setup step.
   */
  const storageConfigured = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
  const mailConfigured = Boolean(
    process.env.RESEND_API_KEY && process.env.ENQUIRY_TO_EMAIL && process.env.ENQUIRY_FROM_EMAIL,
  )

  if (!storageConfigured && !mailConfigured) {
    console.error('[enquiry] neither Supabase nor Resend is configured; enquiry dropped')
    if (isFormPost) return Response.redirect(new URL('/?enquiry=error', request.url), 303)
    return json(
      {
        error:
          'Our form is not connected yet. Please email henry.jamcmahon@gmail.com and we will reply today.',
      },
      503,
    )
  }

  const { error } = storageConfigured
    ? await supabaseAdmin()
        .from('enquiries')
        .insert({
          name: record.name,
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
    : { error: null }

  if (error) {
    console.error('[enquiry] supabase insert failed', error)
    if (isFormPost) return Response.redirect(new URL('/?enquiry=error', request.url), 303)
    return json({ error: 'We could not save that. Please try again.' }, 500)
  }

  /**
   * When the row was written, an email failure must never surface to the visitor: the
   * lead is already safe and a silent log is the right outcome.
   *
   * When storage is NOT configured the email is the only record of the enquiry, so a
   * failure there is fatal and has to be told to the visitor. Returning success while the
   * enquiry disappears is the worst possible behaviour for this form.
   */
  let mailSent = false
  try {
    if (mailConfigured) {
      await new Resend(process.env.RESEND_API_KEY!).emails.send({
        from: process.env.ENQUIRY_FROM_EMAIL!,
        to: process.env.ENQUIRY_TO_EMAIL!,
        replyTo: d.email,
        // Shared with the client's mailto fallback, so both routes to the inbox look
        // identical and one inbox rule catches either. No length cap here: only the
        // mailto path has a URL limit to respect.
        subject: enquiryEmailSubject(record),
        text: enquiryEmailText(record),
        html: enquiryEmailHtml(record),
      })
      mailSent = true

      /**
       * Then the enquirer's own confirmation, best effort.
       *
       * Gated on the sender being a verified domain rather than a separate flag: Resend's
       * test address can only deliver to the account owner, so attempting this while it is
       * configured would fail for every real enquirer. It turns itself on the moment
       * ENQUIRY_FROM_EMAIL becomes a real address.
       *
       * Sent in its own try so a failure here can never affect the response. The lead is
       * already stored and the founder already notified by this point; the visitor not
       * getting an acknowledgement is not worth showing them an error over.
       */
      if (canEmailStrangers(process.env.ENQUIRY_FROM_EMAIL)) {
        try {
          await new Resend(process.env.RESEND_API_KEY!).emails.send({
            from: process.env.ENQUIRY_FROM_EMAIL!,
            to: d.email,
            replyTo: process.env.ENQUIRY_TO_EMAIL!,
            subject: confirmationSubject(),
            text: confirmationText(record),
            html: confirmationHtml(record),
          })
        } catch (e) {
          console.error('[enquiry] confirmation to the enquirer failed', e)
        }
      }
    } else {
      console.warn('[enquiry] Resend not configured; row written, no email sent')
    }
    if (!storageConfigured) {
      console.warn('[enquiry] Supabase not configured; the email is the only record')
    }
  } catch (e) {
    console.error('[enquiry] resend send failed', e)
  }

  if (!storageConfigured && !mailSent) {
    console.error('[enquiry] no storage and the email failed; the enquiry was LOST')
    if (isFormPost) return Response.redirect(new URL('/?enquiry=error', request.url), 303)
    return json(
      {
        error:
          'We could not get that through. Please email henry.jamcmahon@gmail.com and we will reply today.',
      },
      502,
    )
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
