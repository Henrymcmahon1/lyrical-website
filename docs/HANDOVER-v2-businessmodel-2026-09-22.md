# Lyrical v2 handover, business-model change + repo consolidation

**Written 2026-09-22 (end of a long session). For the NEXT Claude session.**
Your job first: **look, think, ask Henry questions, THEN plan + design.** Do NOT start building. Henry
explicitly wants a look-think-ask-plan pass and a breakdown into parallel tasks for multiple bots.

---

## 0. TL;DR of where things stand (all done this session, 21-22 Sep)

- **Render works end to end.** The Python pipeline (repo `lyrical-studio`) runs on the **OptiPlex**
  (always-on Windows render PC, `192.168.86.31`, SSH key `C:\Users\User\.ssh\lyrical_render_pc`).
  A **looping poller** (`scripts\website_poll.py --interval 30`, task `LyricalPoller`) claims any
  Supabase `song_jobs` row with `pipeline_state='queued'`, renders it (incl. **SynthV** on the real
  GPU), and delivers an MP3 to the Supabase `deliveries` bucket. Proven repeatedly (Callaita ES→EN).
- **Self-serve (Door 2) is LIVE on omega.** `https://lyrical-studio-omega.vercel.app` now serves
  **`lyrical-website@develop`** (the Next.js site). I repointed the Vercel `lyrical-studio` project:
  Git→`Henrymcmahon1/lyrical-website`, Framework→Next.js, Root→`./`, **Production Branch→`develop`**,
  and added `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` + `NEXT_PUBLIC_SITE_URL` (Production).
  **Verified**: signed in on omega, submitted through the Next studio → job queued (`route='auto'`)
  → OptiPlex claimed + rendered → delivered → plays back in `/studio`.
- **`main` / `lyricalglobal.com` is UNTOUCHED and must stay that way** until Henry says to promote.
  See memory `lyrical-two-sites-boundary`. All v2 work happens on **`develop` → omega**.

### What I built on `develop` (already pushed)
- `app/studio/self-serve-actions.ts`, `submitSelfServeJob` (privileged, service-role): quota-gates,
  then stamps `route='auto'` + `pipeline_state='queued'` so the render worker picks it up. Also
  `getDeliveredCoverUrl` (signed URL from `deliveries`).
- `components/SongSubmitForm.tsx`, added `selfServe` mode; `app/studio/new` uses it.
- `components/CoverPlayer.tsx`, `components/StudioAutoRefresh.tsx`, play the cover + live status.
- The MANUAL funnel (`submitSongJob`, `status='submitted'`, `/queue`) is left intact.

### Key architecture fact (the decoupling)
Web and render are **decoupled through Supabase**. The website only writes `song_jobs`(queued) +
`song_job_assets`; the OptiPlex poller only reads them. So web changes need **zero** pipeline changes,
and vice-versa. Keep this contract.

---

## 1. Henry's question: "copy `lyrical-studio` INTO `lyrical-website`?", my honest senior take

**Short answer: do NOT copy the whole `lyrical-studio` repo into `lyrical-website`. A senior engineer
would not.** `lyrical-studio` is ~90% a **Python ML pipeline** (torch, Modal, SynthV automation,
`lyrical/`, `dashboard/service`, `scripts/`) that runs on the **OptiPlex/VM**, not on Vercel. Dropping
that into a Next.js/Vercel web repo is the classic anti-pattern: a polyglot repo mixing a GPU ML
service with a web app, bloated installs, confused CI, two totally different deploy targets, unclear
ownership. I advised against exactly this earlier ("Option C").

**What a senior engineer WOULD do, separate by concern, not by folder:**
- **Web repo (`lyrical-website`, Next.js → Vercel):** everything customers/Henry see in a browser ,
  marketing, Door-2 self-serve, and (if we host it here) the Door-1 internal dashboard UI.
- **Pipeline repo (`lyrical-studio`, Python → OptiPlex/VM):** the render worker. Stays its own repo,
  on the machine with the GPU. (Rename to `lyrical-pipeline` later, careful: the OptiPlex actively
  runs from `C:\lyrical-studio` with scheduled tasks; don't rename it out from under a live worker.)

**The nuance that changes the recommendation vs my earlier "Option A":** Henry now wants TWO dashboards
(Door 2 subscriptions + Door 1 internal full-control), and the Door-1 dashboard is the *existing*
`lyrical-studio/dashboard` (Vite React front end + FastAPI back end) that drives the pipeline. That is
a second web app. So the real design question is **where the internal Door-1 dashboard lives**:

- **Option A, internal dashboard stays on the VM** (localhost or a private Tailscale/tunnel, Henry-only).
  It sits *next to the pipeline it controls*, which is the honest place for it. Simplest, no network hop,
  no internal tool on a public host. The website then only carries Door 2 + marketing + Door-1 EOI/
  investor pages. **My lean.**
- **Option B, port the internal dashboard UI into the website** (Next route group `/internal`, gated to
  `henry@lyricalglobal.com`), talking to the VM's FastAPI over an authenticated network path. One place,
  but you must expose/secure the VM backend and re-implement its calls. More work, more surface.
- **Option C, monorepo (Turborepo)** holding `apps/web` (Next) + `apps/internal` (the dashboard) +
  shared packages, with the Python pipeline STILL a separate repo. Cleanest "everything together" for the
  two *web* apps; heavier tooling. Reasonable if we expect lots of shared UI between the two dashboards.

**Recommendation to put to Henry:** keep the Python pipeline as its own repo (do not copy it in). Decide
Door-1-dashboard hosting between A/B/C above, I lean A (keep it on the VM) unless he wants a single
sign-in surface, in which case C (monorepo) beats jamming a Vite SPA into the Next app. Ask him.

---

## 2. The vision (from the v6 artifact, https://claude.ai/artifact/Pkzb6YouK4nJRSbqpdQsHS)

**"One technology, two doors."** Same pipeline; two go-to-market doors.

- **Door 1, the moat (Core royalty).** Signed career artists. **30% of net streaming receipts,
  perpetual + exclusive, $0 upfront.** Human-in-the-loop, high QA, **lossless WAV stems**. Precedent =
  **Coffey Anderson**. This is the internal, full-control dashboard.
- **Door 2, the toy (self-serve, BETA).** "Sing your favourite song in any language." Fans/hobbyists.
  **No free tier.** Three plans (founding-beta prices, grandfathered for life):
  - **Single $9 / track** ($12 after beta), 1 track + 2 free re-rolls
  - **Fan $19 / mo** ($29), 5 tracks/mo, 2 re-rolls each  *(most popular)*
  - **Superfan $39 / mo** ($59), 15 tracks/mo, 2 re-rolls each
  - Output = **one flattened 192k MP3, inaudible watermark, personal-use licence only.**
  - COGS ≈ **$0.50/track**, ~95% margin. The **cap is the funnel**: serious/commercial needs hit a wall
    → pushed to Door 1. Bridge SKU: **Studio Single ~$499–999** (human QA, lossless, commercial;
    undercuts Controlla's $2,000/language anchor).
- **Feedback loop = the product.** Every track: one-tap **👍/👎** (+ optional line). 👎 = instant free
  re-roll (up to 2). Ratings are the **labelled data** (song × language × voice × human rating) that
  trains the placement engine, the flywheel. **This is why the feedback form Henry wants matters.**
- **Three small builds the vision calls out:** (1) inaudible forensic watermark (AudioSeal-class),
  (2) non-commercial licence gate, (3) lossless + commercial unlock for Door 1.
- **Investor framing:** not a tool, a **rights catalog with an engine** (music rights ~10–18× net
  royalty; AI-SaaS ~8–20× ARR). Tailwind: Latin/country/new catalogs.

The pipeline **already ships the capped Door-2 profile by default** (192k MP3, zero-shot Seed-VC 50
steps). Do NOT build a per-tier quality ladder, the caps ride on format + licence + watermark.

---

## 3. The work Henry listed (v2 scope, NOT exhaustive, the next session should refine)

All on `develop` (→ omega). **Nothing here may touch the live `main`/lyricalglobal.com.**

1. **Pricing page** (3 plans above; founding-beta framing; anchor = Controlla $2,000 struck through).
2. **Better sign-up / subscription / dashboard-home** pages. New copy throughout for the new model.
3. **Stripe payments** (subscriptions: Single one-off, Fan/Superfan monthly). Stripe skills + connectors
   are available but **need auth** (tell Henry to authorize the Stripe connector). Use test mode first.
4. **Internal Door-1 dashboard** = the current localhost `lyrical-studio/dashboard`, full functionality,
   **gated to `henry@lyricalglobal.com` / password `lyrical`** (see §1 for where it should live).
   → Two dashboards total: Door-2 (subscription customer) + Door-1 (internal).
5. **Feedback form** for pipeline quality, **saved** (new Supabase table, e.g. `job_feedback`:
   job_id, user_id, rating 👍/👎, note, created_at). This IS the flywheel data, design it well.
6. **Landing page updates** to match the model + a **Coffey Anderson before/after** section (MP3 files
   TBD, ask Henry for them / where they are).
7. **Supabase storage analysis**, are we running out? The `submissions` bucket holds every uploaded
   instrumental+vocal (tens of MB each); `deliveries` holds every MP3. Model growth, retention policy
   (e.g. purge source stems after N days?), and cost. **Real task: measure current usage + project.**
8. **Door 1 on the website**, EOI form? Or an **earnings calculator** for artists (estimate potential
   royalties → present Lyrical as a big opportunity)? Henry is undecided, bring options.
9. **Investor page?**, Henry is asking whether to have one. Decide + (maybe) build from the v6 vision.

---

## 4. Critical constraints (carry these forward, they bit us this session)

- **NEVER touch `main` / `lyricalglobal.com` / the `lyrical-website` PRODUCTION deploy.** Real clients,
  manual funnel. `main` stays frozen; only `develop` → omega. (memory `lyrical-two-sites-boundary`)
- **No em dashes anywhere** (Henry's hard rule). Colon/comma/new sentence instead.
- **Secrets:** never type live API keys/tokens into files or fields. The pattern that works: Henry drops
  a token in a gitignored file and a script reads it (never printed). The Supabase **service key is the
  new `sb_secret_...` format**, the installed `supabase-js` rejects it, so server code that needs it
  hits the **REST API directly** (see how `lyrical-studio/dashboard/frontend/dev-api.ts` did it). In the
  Next repo, `lib/supabase-admin.ts` uses it fine via `@supabase/supabase-js`, because Vercel env has
  the correct value; the rejection was a local-parsing (quoted `.env`) issue.
- **`.env` values are quoted** in the repo `.env` files (`"sb_secret_..."`); strip quotes when parsing by hand.
- **Windows / Modal Python:** prefix `PYTHONUTF8=1 PYTHONIOENCODING=utf-8` (emoji crashes cp1252).
- **SynthV on the render PC** needs the console session + a **clear desktop** (a stray window over SynthV
  makes the "Auto Recovery" pixel-probe misfire). memory `synthv-recovery-false-positive`.
- **One poller only** (OptiPlex primary; AWS VM is a cold standby, two pollers race to claim).

## 5. Facts / addresses you'll need

- Supabase project **`hikvjnpkvnxibfzdnpig`** (`https://hikvjnpkvnxibfzdnpig.supabase.co`). Buckets:
  `submissions` (uploads), `deliveries` (covers). Tables: `song_jobs` (has BOTH `status` for the manual
  funnel AND `pipeline_state`/`route`/`quota_consumed_at` for auto; the website's `supabase/schema.sql`
  is STALE, it predates the automation columns, which exist in the live DB), `song_job_assets`,
  `song_job_deliveries`, `subscriptions` (tier/status/current_period_start), `voice_models`, `profiles`.
  Customers can read `status` but **NOT** `pipeline_state` (column grant). Quota allowance:
  starter 3 / creator 12 / pro 40 (in code, will change to the new plans: Single/Fan 5/Superfan 15).
- Vercel: project **`lyrical-website`** = lyricalglobal.com (prod, DON'T TOUCH). Project **`lyrical-studio`**
  (id `prj_LP1k6o2pomhavFKlXZQEobM4mrMQ`, team `hjam`) now = omega, tracking `lyrical-website@develop`.
- Repos (GitHub `Henrymcmahon1`): `lyrical-website` (Next 16, App Router), `lyrical-studio` (Python
  pipeline + Vite dashboard). Local: `C:\Users\User\CascadeProjects\{lyrical-website,lyrical-studio}`.
- Test accounts (both PRO/active): `henry.jamcmahon@gmail.com` (adc61d4f), `henryjamcmahon@gmail.com`
  (60acefbe). To sign in on omega without an inbox: admin `generate_link` (type magiclink) → take
  `properties.hashed_token` → navigate to `…/auth/callback?token_hash=<hash>&type=magiclink&next=/studio`.
- Stripe / GitHub / other connectors are present but **need Henry to authorize** them (non-interactive
  session can't OAuth). Flag this early.

## 6. Suggested parallelisation (for the "different bots" ask, refine after Henry answers questions)

These are mostly independent once the repo structure + Stripe are decided:
- **Bot A, Payments:** Stripe subscriptions (3 plans), checkout, webhook → write `subscriptions` rows,
  billing/subscription page. (Blocks quota enforcement wording.)
- **Bot B, Marketing + copy:** landing-page rewrite for the two-door model, pricing page, Coffey
  before/after section, investor page. (Needs the Coffey MP3s + copy decisions.)
- **Bot C, Door-2 studio polish:** sign-up/dashboard-home, feedback form (👍/👎 + `job_feedback` table),
  re-roll flow (2 free), watermark + licence-gate builds.
- **Bot D, Door-1 internal dashboard:** stand up the internal control room per the §1 decision, gated
  to Henry. (Depends on the hosting decision.)
- **Bot E, Ops/infra:** Supabase storage audit + retention policy; rename `lyrical-studio`→`lyrical-pipeline`
  safely; harden the poller as a service.
Shared prerequisites (do first, single bot): repo-structure decision, Stripe auth, DB migrations
(`job_feedback`, plan changes), and a short design system / copy deck so the pages are consistent.

## 7. First moves for the next session
1. Read this doc + the v6 vision artifact + memory (`lyrical-two-sites-boundary`, `lyrical-render-optiplex`,
   `lyrical-studio-selfserve-dev`, `lyrical-poller-worker-fix`, `synthv-recovery-false-positive`).
2. Look at `develop` (`app/`, `components/`, `lib/`) and the `lyrical-studio/dashboard` internal app.
3. Bring Henry a short list of **decisions to make** (repo structure per §1; where Door-1 dashboard lives;
   EOI vs earnings calculator; investor page yes/no; Stripe test-vs-live; storage retention). Use
   `AskUserQuestion` (multiple choice, Henry's standing rule), not a bare list.
4. THEN plan + design + break into the parallel tasks above.

---

## 8. Decisions made 22 Sep 2026 (planning session, Henry)

The look-think-ask-plan pass is DONE. The spec and the seven bot briefs are the living documents now:

- Spec: `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` (architecture, data model, every bot's scope, decision log, Henry's open items).
- Briefs: `docs/bots/README.md` lists them and the run order. One fresh session per bot.
- Design page for Henry: https://claude.ai/artifact/Rgk8kaYBHb8JaPHnYqEmRS

Decisions: Door-1 dashboard stays on the render PC (option A); `/artists` = earnings calculator + EOI; `/investors` password gated; Stripe test mode on omega; stems download to the render PC then clear from Supabase on delivery (local copy 30 days for re-rolls); thumbs-down = mandatory detailed note then a Re-roll button (not automatic); all three small builds (watermark, licence gate, lossless export) this round; Coffey files to come from Henry; migrations applied by driving the Supabase SQL editor in Henry's Chrome.

Measured: Supabase 1.72 GB (submissions 1.33 GB, 57 files; over the 1 GB free limit); 22 jobs of which 17 are the live site's manual-funnel uploads (never purge); OptiPlex 136 GB free, poller task Ready.
