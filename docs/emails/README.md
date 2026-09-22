# lyrical emails: plan, schedule, mock-ups

One folder for everything about the emails we send, so it can be seen in one place (Henry, 22 Sep
2026). The next session adds an HTML mock-up per email here (`docs/emails/mockups/<slug>.html`,
rendered with `lib/email-shell.ts`), and wires each trigger.

## Principles
- Every email is a single message with one action. Plain words, no "beta", lowercase `lyrical`.
- Sent through Resend from the website (`lib/mailer.ts`), from a verified domain, never `@resend.dev`.
- Product emails can be switched off per account (`/studio/account`); transactional ones cannot.
- Each send is logged (`email_log`: user, slug, sent_at, provider id) so support can see what a
  person received.

## The set (Henry approved 22 Sep)

| Slug | When | To | Says | Action |
|---|---|---|---|---|
| `welcome` | first successful sign-in, once per account | the new user | what to upload, what happens next, the turnaround promise | Make your first track |
| `plan-confirmed` | Stripe `checkout.session.completed` (paused with Stripe) | the buyer | plan name, tracks included, renews on, receipt is from Stripe | Open the studio |
| `track-delivered` | `song_jobs` becomes `delivered` (original) | the owner | title and language, licence line, please rate it | Listen and rate |
| `reroll-delivered` | a child job becomes `delivered` | the owner | "Take N is ready", how many re-rolls remain | Listen |
| `track-not-made` | `song_jobs` becomes `rejected` at our end | the owner | plain apology, it did not count, make it again | Make it again |
| `eoi-received` | artist EOI submitted | the artist | we have it, what happens next, who they will hear from | none |
| `enquiry-received` | contact form submitted | the sender | same shape as above | none |
| `rating-reminder` | 24 h after delivery if unrated (product email, opt-out) | the owner | a gentle nudge to rate the track, why ratings help | Rate your track |

## Schedule and reminders (CONFIRMED 22 Sep, evening)
- No drip sequence in v3.
- **`rating-reminder` IS in scope for v3** (Henry: "build it now"): sent 24 hours after a delivery
  if the track is still unrated. Product email, opt-out, respects the `/studio/account` preference.
  Fired by a scheduled check (Vercel Cron on `/api/hooks/rating-reminder`, or the poller), not a
  drip. See the row added to the set below.
- Never more than one product email per person per day.

## Triggers (how each one fires)
- Sign-in and enquiry emails: from the website's own server actions and routes.
- Job emails: a Supabase Database Webhook on `song_jobs` UPDATE posts to `/api/hooks/song-job` with a
  shared secret; the route sends only on a state transition it recognises and logs the send.
- Plan emails: from the Stripe webhook route.

## Mock-ups
`mockups/` is empty until the next session. Each file is the exact HTML the site sends, viewable in
a browser, with the subject line as the page title.
