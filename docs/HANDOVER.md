# Lyrical website — handover

**Date:** 2026-07-31 · **Live:** https://lyricalglobal.com ·
**Repo:** https://github.com/Henrymcmahon1/lyrical-website · **Vercel team:** `hjam`

Read this before touching anything. Most of what follows was learned by breaking something,
and none of it is obvious from the code.

---

## 0. Read these four things first

1. **THE REPO IS PUBLIC.** `"private": false`. Anything you commit is world-readable the
   instant it is pushed. In this session I hardcoded the `/leads` password into a throwaway
   probe script, `git add -A` swept it up, and it went to a public repo. It had to be rotated.
   **Never put a credential in a file here, even for one command.** Pass it via `process.argv`
   or an environment variable. `*-probe.mjs` and `*-e2e.mjs` are gitignored for this reason.
2. **Secrets are unreadable from an agent sandbox.** `vercel env pull` returns the literal
   string `[SENSITIVE]` (13 bytes with quotes) for every secret value. If you send that to an
   API it will be rejected, and that is a fact about the sandbox, **not** about the key. Do not
   report it as a bad key. I did, once, and it was wrong.
3. **You cannot create accounts or enter API keys.** Henry does that. You can do everything
   either side of it, including all DNS via the Vercel CLI.
4. **Everything is verified by running it, never by assuming.** Four separate times this
   session, something that looked right was wrong, and twice my *test* was wrong rather than
   the code. Run the audits in §6.

---

## 1. What this is

A funnel-first marketing site for **Lyrical**, which re-sings existing recordings in another
language in the original artist's voice, keeping the melody, phrasing and the untouched
original instrumental.

**The site has one job: convert a rights holder into an enquiry.** Lyrical's own strategy says
*authorization, not production capability, is the binding constraint*. So the site sells
**trust**, not technology.

Founders: **Jordan Brock** (brand, commercial) and **Henry McMahon** (engineering, the user).

---

## 2. Current state — what works

| | |
|---|---|
| Stack | Next.js 16.2, React 19, Tailwind 4, TypeScript |
| Tests | **171**, all passing (`npm test`) |
| `npm audit` | **0 vulnerabilities** |
| Domain | **https://lyricalglobal.com**, TLS live, `www` 308s to apex |
| DNS | Nameservers moved to Vercel, so **all DNS is CLI-manageable** (`vercel dns add`) |
| Database | **Working.** Supabase `enquiries` table exists, RLS on, no anon policy |
| Enquiry form | **Working.** Live POST returns 200, row written, notification email sent |
| `/leads` | **Working.** Password gated, list, mark handled, CSV export |
| Analytics | Vercel Web Analytics live (`window.vam === 'production'`) |
| Deploy | **Manual only.** GitHub is NOT connected to Vercel. `git push` does nothing on its own |

### Verified end to end on production

Submit → 200 → row in Supabase → email to `henry.jamcmahon@gmail.com` → visible on `/leads`
→ CSV export contains it → mark handled moves it between views → sign out makes the export 404.

---

## 3. What is NOT done

### 3.1 The enquirer confirmation email is built but dormant

`ENQUIRY_FROM_EMAIL` is still `onboarding@resend.dev`, which Resend only delivers to the
account owner. `canEmailStrangers()` in `lib/enquiry-email.ts` derives the switch from the
sender address, so **the moment that variable becomes a verified-domain address, the
confirmation turns itself on**. No code change, no flag.

**Do not change it early.** Resend rejects senders on unverified domains, which would break the
internal notification too.

### 3.2 Email host and Resend — the sequence Henry agreed

1. Henry creates a **Zoho Mail** account (Forever Free: 5 users, 1 domain, real mailboxes).
   Chosen over ImprovMX because ImprovMX's free tier is **forwarding only, no SMTP sending** —
   you could receive at `hello@` but never send as it, which is wrong for a business selling
   trust.
2. Zoho shows a **TXT verification record and MX records**. These are account and region
   specific (`zoho.com` vs `zoho.com.au`), so they cannot be guessed. Henry pastes them to you.
3. **You add them** with `npx vercel dns add lyricalglobal.com <name> <type> <value>`.
4. Henry creates the `hello@lyricalglobal.com` mailbox.
5. Henry creates a **new Resend account using `hello@lyricalglobal.com`**. This also solves the
   plan limit: the existing Resend account's single free domain slot is taken by an unrelated
   `avenuemission.com`. A fresh account for the company is the correct structure anyway.
6. Henry adds `lyricalglobal.com` in Resend, pastes you the DKIM/SPF records, you add them.
7. You set `ENQUIRY_FROM_EMAIL=hello@lyricalglobal.com` and `RESEND_API_KEY` (Henry supplies
   the key), redeploy, and the confirmation email switches on.

### 3.3 Still open, no decision yet

- **No audio anywhere.** Every `hasAudio` in `content/demos.json` is `false`. The hero says
  "Hear a before and after" and leads to a page with nothing to play. This is the single
  largest conversion lever on the site and the only one that cannot be faked. Blocked on rights.
- **No social proof.** No client names, testimonials or case studies on any route.
- **No pricing signal at all.**
- Four open recommendations from the first session, still undecided: un-pin *What you receive*
  on desktop, rights-first on the home page, Jordan's "$100 million" claim, and the changed
  tagline. Raise them, do not action them.
- **Settled 2026-08-03:** the name is **Lyrical**, one L. Confirmed by Henry. The site already
  spelt it that way; the brand kit and README no longer carry it as an open question.

---

## 4. Locked decisions. Do not silently change these.

### Brand

| Token | Hex | Job |
|---|---|---|
| cream | `#F7EFE1` | space |
| graphite | `#1C1A19` | typography |
| indigo | `#4433D6` | identity |
| ember | `#EE4E22` | action |

Dark treatment (listening sections only): ground `#1B1D1F`, ink `#EDEBE4`, accent `#FF6B2C`.

- **No gradients that paint.** A gradient in `mask-image` is alpha, not paint, and is allowed.
- **Ember never carries body text** — 3.2:1 on cream. Fills and large type only.
- **Indigo is never used on the dark ground** — 2.7:1.
- Fonts: **Fraunces** + **Archivo**, self-hosted woff2, never a CDN. Headings are explicitly
  `font-weight: 600` because Tailwind preflight resets them to 400.
- The full brand system, generated from the same geometry the site uses, is in `brand-kit/`.
  Regenerate with `npx tsx scripts/build-brand-kit.mjs`. Never hand-edit those files.

### Copy rules, enforced by `tests/copy.test.ts`

- **"AI-generated"** — say *recreated*, *re-sung*, *performed*, *transcreation*.
- **`6.4×`, `2.38B`, any population multiplier.** A rights holder's lawyer reads this site.
- **"Solutions"** as a nav label.
- **No em-dashes** in visitor-facing copy.
- **No artist names.**

### Stated assumption, on the record

The site claims **8 languages**. The internal capability document proves **Spanish ↔ English**
only. Raised with Henry three times and confirmed. Do not reopen without being asked.

---

## 5. Gotchas that cost real time

**Two scroll clocks, and they are not interchangeable.** `lib/scroll-progress.ts` exports
`trackProgress` and `entryProgress`. Track progress is 0 at the moment a sticky panel sticks —
when the panel already fills the screen — so a fade keyed to it starts at `opacity: 0` on a full
screen. It is also **forced to 1 whenever an element is shorter than the viewport**, which is
what silently disabled the mobile morph for weeks. Use it only where something actually pins.

**Every section pins at every width now.** The old mobile gate is gone. Two unpinned
alternatives were tried and both were worse: a carousel sliced cards mid-word, and a sticky rail
collided with the heading. The trap the gate feared is prevented by construction instead: the
panel is `calc(100vh - var(--nav-h))` and sticks *below* the nav, travel is bounded at 18vh per
step on mobile against 26vh on desktop, and a progress line under the nav shows scrolling is
still doing something.

**The mark has no counter.** `≈` is two open strokes; its middle is the *gap*. Any aperture,
punch-out or clip-through built from it renders a blank cream screen. Use overlapping
transform+opacity layers.

**Never use `animation-timeline: view()`.** It was observed pinning elements at negative
progress alongside Lenis, leaving 14 of 17 sections permanently at `opacity: 0`.
IntersectionObserver only. A test asserts this.

**Reveal animations must stay scoped to `.js-motion`.** An inline script in `layout.tsx` adds
it before first paint. Unscoped, every wrapped section renders invisible with JS off.

**In-memory rate limiting does not work on Vercel.** Measured, not assumed: six wrong passwords
against production were throttled **zero** times, because requests spread across serverless
instances and each saw its first attempt. It *is* effective on `/api/enquiry` (five then 429,
confirmed live) only because bursts tend to hit one warm instance. `/leads` is protected by the
password strength plus a 500ms delay on failed logins, not by the limiter. Real per-IP limiting
needs shared state in Redis or Postgres.

**`requestAnimationFrame` is paused in the in-app Browser pane.** Anything rAF-driven reads as
inert there. Use Playwright for motion; the pane is fine for static geometry.

**Lenis eases scroll.** Any `scrollTo` in a test must poll until `scrollY` settles. A fixed
timeout samples mid-flight and gave false readings twice.

**Network Solutions' account area renders blank under browser automation.** Do not try to drive
it. DNS is at Vercel now anyway.

**Vercel certs do not always auto-issue.** A `000` from curl on a fresh domain usually means no
certificate exists (`vercel certs ls` confirms), not a DNS fault. Force with `vercel certs issue`.

**`npm audit fix --force` wanted to install `next@9.3.3`.** It is not a fix. `sharp` and
`postcss` are pinned via `overrides` in `package.json` instead, which cleared all 7 advisories.

---

## 6. How to verify anything

```bash
npm test                                            # 171 tests
npx eslint .                                        # must be silent
npx tsc --noEmit                                    # must be silent
npm run build                                       # must compile clean
npm audit --omit=dev                                # must be 0

node scripts/preflight-enquiry.mjs                  # which env vars exist, what a visitor gets
node scripts/preflight-enquiry.mjs --smoke          # sends ONE real labelled test enquiry
node scripts/audit-responsive.mjs <url>             # overflow, blank screens, tap targets
node scripts/audit-motion.mjs <url>                 # proves the motion MOVES, 31 assertions
node scripts/audit-enquiry.mjs http://localhost:3000 # the 503 path and the mailto fallback
```

`audit-enquiry` asserts the **unconfigured** branch, so run it against a local server with no
`RESEND_API_KEY`, not production.

**The tests are not decoration.** They encode commitments: measured contrast ratios, the banned
copy list, that no secret appears in a client component, that no `NEXT_PUBLIC_` variable other
than the site URL exists, that email HTML escapes user input, that the CSV export defuses
spreadsheet formula injection, and that the pin never runs under reduced motion. If one fails,
fix the code.

**Deploy is manual:**

```bash
git push origin main && npx vercel --prod --yes
```

---

## 7. Credentials and where they live

Nothing secret is in the repo. All of it is in Vercel → Settings → Environment Variables, and
values can be revealed there with the eye icon.

| Variable | State |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Set (Preview + Production) |
| `RESEND_API_KEY` | Set (Preview + Production). Will be replaced when the new Resend account exists |
| `ENQUIRY_TO_EMAIL`, `ENQUIRY_FROM_EMAIL`, `GATE_SECRET` | Set (all three environments) |
| `NEXT_PUBLIC_SITE_URL` | `https://lyricalglobal.com` (Production + Preview) |
| `ADMIN_PASSWORD` | Set (all three). **Rotated 2026-07-31 after I leaked the previous value.** |

`GATE_SECRET` signs two different things: the visitor audio-gate cookie and the `/leads`
session. The admin payload is namespaced `admin:` for that reason — without it, every visitor
who asked for examples would hold a valid admin session. A test asserts a gate token is rejected.

---

## 8. File map

| Path | Responsibility |
|---|---|
| `lib/mark.ts` | Pure Bézier geometry. The mark is *generated*, never hand-drawn |
| `lib/scroll-progress.ts` | The two clocks. Read its doc comment before using either |
| `lib/enquiry-email.ts` | One source for the notification and the confirmation, plus the mailto fallback |
| `lib/enquiry-schema.ts` | Zod schema. `name` is conditionally required: optional for the gate |
| `lib/admin-auth.ts` | `/leads` session signing and password check. Fails closed |
| `lib/rate-limit.ts` | In-memory limiter. Read the honest limitation in its doc comment |
| `lib/csv.ts` | CSV writer that defuses spreadsheet formula injection |
| `app/api/enquiry/route.ts` | Validate → rate limit → Supabase → Resend → cookie, with a degradation ladder |
| `app/leads/` | The enquiry inbox. Page, server actions, CSV export route |
| `components/Pinned*.tsx` | The pinned sections, now pinning at every width |
| `next.config.ts` | Security headers, CSP, and the www → apex redirect |
| `brand-kit/` | Generated brand kit. Share the folder; start at `brand-guide.html` |
| `supabase/schema.sql` | Idempotent. Safe to re-run |

**Audio drop-in:** `public/audio/{src}-{tgt}/{slug}.original.mp3` and `.translated.mp3`,
lowercase pair folder, then set `hasAudio: true`. Adding a pair is a data change.

⚠️ The "Send me before and afters" button promises **a personal email**, because no audio
exists. If audio is published, update that copy.

---

## 9. Do not repeat these mistakes

Four things went wrong in this session that were mine, not the code's:

1. **A credential in a committed file.** Covered in §0.
2. **Trusting a control I had not measured.** I shipped rate limiting and a weak generated
   password believing the limiter protected it. A live test showed it did not throttle at all.
   Measure the control, then choose the password strength that survives the control failing.
3. **Tests that asserted the wrong property.** Twice a "failure" was my assertion, not the
   code: checking class names where I should have checked `position: sticky`, and checking
   elements at rest where I should have checked only what was on screen. When a test fails,
   ask what property actually matters before touching either side.
4. **Reporting a sandbox artifact as a user-facing fault.** See §0 item 2.
