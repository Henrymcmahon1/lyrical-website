# Lyrical clean-up plan

**Written 2026-09-22.** Planning only, nothing here has been executed. Source: section K of
`docs/HANDOVER-v3-2026-09-22.md` and sections 10 to 13 of
`docs/superpowers/specs/2026-09-22-two-doors-v2-design.md`.

## 0. Goal, scope, ground rules

**Goal:** both repos at a structure a new engineer can be onboarded into, per Henry's
"software-company-level structure" instruction in section K.

**Scope:** two repos.
1. `lyrical-website` (this repo), Next 16 on Vercel, branch `develop`. Live site, real clients.
2. `lyrical-studio`, Python pipeline, runs on the OptiPlex render PC (192.168.86.31). This
   machine has a local copy on `main`; the render PC itself was not inspected for this plan
   (see the explicit "not verified" notes in sections 4 and 10).

**Ground rules:**
- Never touch `main` of `lyrical-website` or lyricalglobal.com.
- Never push or deploy anything as part of executing this plan without Henry's go-ahead.
- Verify before deleting: every dead-code claim below was grepped, not assumed. Anything not
  checked is marked unverified and must be checked again before acting on it.
- No em dashes in anything this plan produces.

## Suggested order of operations

Cheapest and highest-value first. "Safe to execute" means no live-site behaviour changes and
no secrets touched; it does not mean skip review, it means Henry does not need to be in the
loop before the work starts (he still reviews the diff).

| # | Step | Effort | Safe without sign-off? |
|---|---|---|---|
| 1 | Delete the confirmed-dead marketing sections (§4) | S | Review diff, then yes |
| 2 | Archive old handovers to `docs/history/` (§7) | S | Yes |
| 3 | Env var matrix doc (§6) | S | Yes |
| 4 | Fix the `ACRCLOUD_SECRET` vs `ACRCLOUD_ACCESS_SECRET` mismatch (§10) | S | Yes (docs/example only, not live code) |
| 5 | Decide the two untracked `lyrical-studio/scripts/*.py` files: commit or delete (§4, §10) | S | Ask Henry first, see §4 |
| 6 | ADRs from the decision log (§2) | M | Yes |
| 7 | READMEs to the "hour to onboard" bar (§1) | M | Yes |
| 8 | CI workflows, non-deploying (§5) | M | Yes to add; do not wire deploy |
| 9 | `lyrical-studio` target folder layout (§3) | M | Review with Henry before moving files (render-PC paths depend on current layout) |
| 10 | Naming pass, safe items only (§8) | M | Yes for safe items; unsafe items need Henry |
| 11 | Money-path test gaps (§9) | M | Yes to add tests; the real Stripe run stays Henry-gated |
| 12 | Everything else in §10 | varies | Case by case, flagged individually |

---

## 1. One README per repo, onboarding in an hour

Both repos already have a README (`lyrical-website/README.md`, 130+ lines;
`lyrical-studio/README.md`, ~190 lines). Neither is bad, but neither covers the full list below.
This is an edit pass, not a rewrite.

**`lyrical-website/README.md` needs added:**
- Architecture overview: Next 16 App Router, Supabase (auth + Postgres + storage), Stripe
  (paused), Resend for email, the pipeline repo as the render backend reached only through
  `song_jobs` rows and a Database Webhook, not a direct API call.
- Key directories: `app/` (routes, one folder per route + `api/`), `components/` (shared UI),
  `components/sections/` (home-page sections, several currently unused, see §4),
  `lib/` (business logic, one file per concern, e.g. `entitlement.ts`, `stripe-webhook.ts`),
  `supabase/` (schema + migrations), `tests/` (vitest, one file per lib/route), `docs/`
  (handovers, specs, bot briefs, brand).
- How to run locally: already has `npm install`, `npm run dev`, `npm test`, `npm run build`;
  add the `.env.local` minimum (already documented for build, per the v3 handover; state it
  in the README, not just discovered by a future session).
- How to deploy: `develop` auto-deploys to omega on push; `main` is never touched; who has the
  Vercel access (Henry, team `hjam`).
- Where secrets live: Vercel env vars for omega, `scripts/.supabase_token` /
  `scripts/.vercel_token`-style gitignored local files do not exist in this repo (those are a
  `lyrical-studio` pattern, see §10), so state plainly "no local secret files, Vercel env only."
- Who to ask: Henry, for anything Stripe/Resend/Supabase/domain-related (he holds every
  external account).

**`lyrical-studio/README.md` needs added:**
- Architecture overview: the six-stage pipeline (acquire, separate, read/align, write/translate,
  sing, restore) in `lyrical/stages/`, driven by `lyrical/worker.py`, fronted by the
  `dashboard/` (FastAPI backend + React/Vite frontend) for interactive use and by
  `scripts/website_poll.py` for the render-PC service loop against Supabase `song_jobs`.
- Key directories, mapped concretely (this is what §3 turns into a target layout):
  `lyrical/` (the pipeline library: `stages/`, `align/`, `translate/`, `sing` via `synthv/`,
  `phonetics/`, `grid/`, `store/`, `training/`, `core/`), `dashboard/` (`backend/` FastAPI,
  `frontend/` Vite+React, `service/` the shared business logic both the dashboard and the
  website poller call into), `scripts/` (operational one-offs: purge, requeue, env setup,
  watermark detection), `deploy/` (render-PC and AWS-VM runbooks), `config/jobs.json`, `tests/`.
- How to run locally: already documented (`dashboard/run.ps1 -Mlflow`, `DASHBOARD_NO_WORKER=1`
  for zero-spend browsing). Add: how to run the website poller locally against a test
  Supabase project, if that is ever needed outside the render PC.
- How to deploy: scp to the OptiPlex (`deploy/render-pc.md`, `deploy/render-pc-v2.md`, the
  render PC cannot reach GitHub, ship via `git bundle`), restart the `LyricalPoller` scheduled
  task. State which of the two render-pc docs is current (see §7, both exist today).
- Where secrets live: repo-root `.env` (gitignored), `scripts/.supabase_token` and
  `scripts/.vercel_token` (gitignored, read by the two untracked scripts, see §4/§10).
- Who to ask: Henry for Qobuz/Modal/R2/OpenAI/Anthropic/DashScope/Suno keys and anything on the
  OptiPlex itself (physical machine, not remotely provisioned by this session).

Effort: **M** (both repos, careful writing, no code risk). Risk: **none** (docs only).
Safe to execute without sign-off: **yes**.

## 2. ADRs for the v2 spec decision log

The decision log lives in section 13 of the v2 spec (6 dated entries, 22 Sep and 21 Sep).
Not every entry is architectural; status updates and bug-fix notes are folded into the ADR
they belong under rather than getting their own file. Proposed:

| ADR file | Documents |
|---|---|
| `docs/adr/0001-door-2-business-model.md` | 21 Sep: Door 2 as a fan-toy beta, three plans (Single/Fan/Superfan), no free tier, 2 free re-rolls, one-tap feedback, quality capped by format+licence+watermark, self-serve royalty parked. |
| `docs/adr/0002-two-repo-boundary-and-single-frontend.md` | Section 2 of the spec (two repos, one contract) plus the 22 Sep decision that the Next site is the only Door-2 front end (the reason the Vite customer mode in `lyrical-studio/dashboard/frontend` is dead, see §4). |
| `docs/adr/0003-stripe-and-retention-policy.md` | 22 Sep: Stripe test mode on omega before live; stems download to the render PC then purge from Supabase; failed jobs kept 7 days for retry. |
| `docs/adr/0004-home-and-nav-information-architecture.md` | 22 Sep morning + second review: original seven-section home flow kept, one two-doors section added as the closer (`S10Start` removed, see §4), "beta" confined to licence terms and one pricing sentence, no comparison tables, nav reduced to Home / Get started / Studio, 30% figure removed from public pages. |
| `docs/adr/0005-turnaround-promise-and-rating-reminder.md` | v3 session: fixed "usually within 1 hour, up to 3 hours at busy times" promise for every plan (not a live estimate), 24-hour rating-reminder email in scope. |
| `docs/adr/0006-copyright-enforcement-stance.md` | Section H of the v3 handover: fingerprint at upload, block commercial matches, ACRCloud primary with AudD fallback, personal-use licence for what passes. |

Effort: **M** (6 short documents, content already exists in the spec and handover, mostly
extraction and reformatting). Risk: **none**. Safe without sign-off: **yes**.

## 3. Consistent folder layout

`lyrical-website` already has a clean, conventional layout: `app/` (routes), `components/`
(UI, with `components/sections/` and `components/studio/` as sub-groups), `lib/` (logic),
`supabase/` (data layer), `tests/`, `docs/`, `scripts/` (build/ops one-offs), `content/`
(static copy objects), `public/`, `brand-kit/`.

`lyrical-studio` top level today: `lyrical/` (the pipeline library), `dashboard/` (backend +
frontend + the `service/` layer shared with the website poller), `scripts/` (operational
scripts, mixed purposes: purge jobs, watermark detection, env setup, autoscale), `deploy/`
(runbooks, `aws/` and `render-pc/` subfolders plus two top-level render-pc docs), `config/`
(one file, `jobs.json`), `tests/`, plus root clutter: `run.py`, `pyproject.toml`,
`requirements.txt`, two sqlite files (`lyrical.sqlite`, `lyricall.sqlite`, see §8 and §10),
`mlruns/` (MLflow tracking data), `work/` (render scratch space), `.superpowers/`.

**Mapping and proposed target layout** (rename/move, not a rewrite, kept incremental so the
render PC's scp deploy path is not broken mid-flight):

| Website convention | Studio equivalent today | Target |
|---|---|---|
| `app/` (routes) | `dashboard/backend/routers/`, `dashboard/frontend/src/features/` | keep, no change needed, already route/feature-organised |
| `lib/` (business logic) | `lyrical/` (the pipeline stages) + `dashboard/service/` (shared service layer) | keep the split; document it explicitly in the README (§1) since it is not obvious that `dashboard/service/` is the shared layer both the dashboard UI and the website poller call, not dashboard-only code |
| `scripts/` (ops one-offs) | `scripts/` (already exists, but mixes purge/requeue/detect/env-setup/autoscale without sub-grouping) | split into `scripts/ops/` (purge_*, requeue_job.py, website_autoscale.py) and `scripts/setup/` (set_auth_redirects.py, set_vercel_env.py) once those two untracked files are triaged (§4) |
| `docs/` | `docs/` (21 files, mostly dated handovers, no subfolders) | add `docs/history/` (§7) and `docs/adr/` (§2), matching the website's structure |
| (n/a) | `config/jobs.json` | keep as is, single file does not need a folder change |
| (n/a) | `mlruns/`, `work/`, `lyrical.sqlite` | already gitignored; no folder change needed, just confirm the README states these are runtime output, not source (partially done, `work/` and `mlruns/` are called out in `.gitignore` comments already) |

Effort: **M** (mostly `scripts/` regrouping and doc folders; nothing touches the render PC's
existing paths except `scripts/`, which needs the deploy runbook updated in the same PR).
Risk: **low-medium**, only because `deploy/render-pc.md` / `deploy/render-pc-v2.md` and the
scheduled task's working directory reference current script paths; moving `scripts/*.py`
without updating those runbooks would break the next deploy. Safe without sign-off: review
with Henry before moving `scripts/` (step 9 in the order of operations), the `docs/` additions
are safe alone.

## 4. Dead code to delete, verified

Each item below was actually checked this session, not taken on the handover's word.

**Home-page marketing sections** (`components/sections/S03Steps.tsx`, `S04Plans.tsx`,
`S05Beta.tsx`, `S06Artists.tsx`, `S07Close.tsx`, `S10Start.tsx`):
- Verified by grepping `S03Steps|S04Plans|S05Beta|S06Artists|S07Close|S10Start` across the
  whole `lyrical-website` repo. Matches exist only in: each section's own file, `tests/`
  (comments only, e.g. `tests/home.test.tsx` line 24 says "`S10Start` is off this page", no
  import), `docs/` (handovers and the v2 spec, historical narration), and `content/two-doors.ts`
  (a comment noting `S05Beta` is "kept for" that component, no import).
- Then read `app/page.tsx` directly: its import list is `S01Hero, S02bAudience, S02Coffey,
  S03Wheels, S04Fidelity, S05How, S09bNow, S09cDoors`. A comment at the top of the file states
  explicitly: "The v2 sections (`S03Steps`, `S04Plans`, `S05Beta`, `S06Artists`, `S07Close`) stay
  on disk and off this page," and `S10Start` "came off" per the second review.
- Also checked the other three routes that import section-like components (`app/hear/page.tsx`,
  `app/ai-music-translation/page.tsx`, `app/about/page.tsx`): none import any of the six.
- **Verdict: genuinely unreachable from any route. Safe to delete the six `.tsx` files.** No
  dedicated test file exists for any of them (checked `tests/` for `S03`, `S04`, `S05`, `S06`,
  `S07`, `S10` filenames, only `tests/plans.test.ts` exists and it tests `lib/plans.ts`, an
  unrelated pricing-tiers-ids file, not `S04Plans.tsx`).
- Before deleting: `S02Coffey` is explicitly NOT dead (per the same `app/page.tsx` comment, it
  moved into `S02bAudience` as a prop-driven slot), do not delete it by pattern-matching on "S0".

**Old pricing "tiers" code:** not independently verified this session beyond confirming
`lib/plans.ts` (current, tested, `tests/plans.test.ts`) is the live plan model and that
`dashboard/service/website/precheck.py`'s render-time entitlement check in `lyrical-studio`
still references `starter/creator/pro` tier names per section 9 of the v2 spec. **Unverified
claim, needs a grep pass in `lyrical-studio` for `starter`, `creator`, tier literals before
anyone deletes anything**; flagging as a to-check item rather than a confirmed dead-code entry.

**`run_poll_loop.cmd`:** grepped `lyrical-studio` root, `scripts/`, and `deploy/` for
`run_poll_loop` (case-insensitive). **It does not exist anywhere on this machine's copy of the
repo.** The only hit anywhere in the repo is a mention inside
`docs/WEB-STUDIO-HANDOVER-MASTER-2026-09-17.md` (historical narration). Given the v3 handover
(section 2b) confirms the poller now runs as a Windows scheduled task
(`LyricalPoller`) rather than a loop script, this item from section K is already resolved,
most likely superseded by the scheduled-task change and never re-added. **Nothing to delete
here; note in the next handover that this line item in section K is stale, not outstanding.**

**Vite customer mode** (`lyrical-studio/dashboard/frontend`, per v2 spec section 10, naming
`VITE_CUSTOMER_MODE`, `CustomerCreationPage`, `CustomerLibrary`, `CustomerSongDetail`,
`api/submit.ts`, `dev-api.ts`, `entitlement/`, `mode.ts`):
- Verified by listing `dashboard/frontend/src` in full (3 levels deep) and grepping the whole
  `lyrical-studio` repo for each of those six names. **None of them exist on disk.** The
  frontend's actual structure is `api/` (client.ts, hooks.ts, ws.ts, types.gen.ts, no
  submit.ts), `components/`, `features/` (pipeline, running, songCreation, songsLibrary,
  stages, voiceModels), no `entitlement/` folder, no `mode.ts`.
- **Verdict: this dead-code item from the v2 spec is already gone.** Either it was removed in
  an earlier session and the spec's section 10 was never updated, or `VITE_CUSTOMER_MODE` was
  planned but never built. Either way, nothing to delete; the spec line is stale and should be
  struck when this plan is acted on.
- Caveat: memory note `lyrical-studio-selfserve-dev` describes a `dev-api.ts` serving
  `/api/submit` for a "studio-customer preview." That file was not found anywhere in this
  repo's frontend during this check. If Henry still uses that preview, it is either in an
  uncommitted local state on the render PC (not inspectable from this machine) or the memory
  note itself is stale. **Flagging as unverified, ask Henry before assuming it is gone
  everywhere.**

**Untracked helper scripts:** `git status --short` on `lyrical-studio` (branch `main`) shows
exactly two untracked files: `scripts/set_auth_redirects.py` and `scripts/set_vercel_env.py`.
Read both in full:
- `set_auth_redirects.py`: adds the studio's local/preview/prod URLs to Supabase Auth's
  redirect allow-list via the Supabase Management API, reading a token from the gitignored
  `scripts/.supabase_token`.
- `set_vercel_env.py`: pushes `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` to a Vercel project
  it calls `lyrical-studio` (hardcoded project id `prj_LP1k6o2pomhavFKlXZQEobM4mrMQ`) for an
  `/api/submit` endpoint. **This references the same dead `/api/submit` customer-mode endpoint
  investigated above**, so this script may itself target dead infrastructure; the Vercel
  project id it targets is also NOT `lyrical-website`'s own Vercel project (which deploys to
  omega, project name confusingly also containing "lyrical-studio" in its domain, see §10),
  raising the real possibility this script points at a stale or unused third Vercel project.
- **These are the "untracked helper scripts" section K refers to.** Not dead code by
  import-graph (they are standalone scripts, nothing imports them), but undocumented and of
  unclear current relevance given the `/api/submit` finding above. **Do not delete without
  asking Henry** whether the `lyrical-studio` Vercel project and its auth redirect list are
  still in use; if not, delete both files and their `.gitignore` entries
  (`scripts/.supabase_token`, `scripts/.vercel_token`); if yes, commit them with a short header
  comment explaining when to run them (they currently have none).

Effort: **S** for the six confirmed-dead section files; **S** for a follow-up grep to check the
pricing-tiers claim; **S** for the two-script decision (mostly a conversation with Henry, not
code). Risk: **low** for the section files (nothing imports them, tests do not reference them
as components); **low** for the scripts either way since they are standalone and untracked.
Safe without sign-off: the six section files, yes, after one more look at the diff; the two
scripts, ask first (they may point at live infrastructure).

## 5. CI on both repos

Neither repo has a `.github/workflows/` directory (checked both, confirmed absent).

**`lyrical-website`:** `package.json` already defines `lint` (`eslint`), `test` (`vitest run`),
and `build` (`next build`). Propose `.github/workflows/ci.yml`:
- Trigger: `pull_request` targeting `develop` (never `main`, per the ground rules).
- Jobs: `lint` (`npm run lint`), `test` (`npm test`, currently 872+ tests per the v3 handover),
  `build` (`npm run build`, needs a placeholder `.env` with dummy Supabase values, the same
  prerender requirement noted in the v3 handover as already solved locally via `.env.local`;
  the workflow needs its own dummy values as repo secrets or inline env, not real ones).
- Explicitly do NOT add a deploy job; Vercel's own git integration already deploys `develop`
  on merge, and section K's remit is CI (test/build/lint), not touching deploy behaviour.

**`lyrical-studio`:** `pyproject.toml` already configures pytest (markers for `slow` and
`synthv`, both deselected by default via `addopts = "-m 'not synthv and not slow'"`). Propose
`.github/workflows/ci.yml`:
- Trigger: `pull_request` targeting `main`.
- Jobs: `test` (`pip install -r requirements.txt`, `pytest`, which with the existing addopts
  already skips the desktop-app-coupled (`synthv`) and artifact-coupled (`slow`) tests, so it
  should run clean on a GitHub runner with no SynthV, no render PC, no real audio files).
- **Caveat, unverified from this machine:** whether the remaining (non-slow, non-synthv) test
  suite actually passes hermetically on a clean runner was not confirmed this session (no
  Python environment was executed here). Before wiring this up for real, run
  `pytest -m "not synthv and not slow"` locally first and fix anything that assumes local
  state (API keys, `.env` values, `work/` contents) that a CI runner will not have.
- No `lint` job proposed: no linter config (ruff/flake8/black) was found in `pyproject.toml` or
  elsewhere in the repo root; adding one is a separate decision, not assumed here.
- No `build` job: this is a library + two run-modes (CLI, dashboard), not a package that ships
  a build artifact in the CI sense; the dashboard frontend's own `npm run build` could be added
  as a second job if Henry wants the Vite build checked, but that was not asked for.

Effort: **M** each (workflow file is small, but getting the placeholder env / dummy secrets
right and confirming `pytest` is actually green outside this session takes iteration).
Risk: **low** (CI failing does not affect the live site or the render PC; it only gates PRs).
Safe without sign-off: **yes** to add the workflow files; branch protection rules that would
block merges on red CI are a separate, higher-stakes change and should go to Henry first.

## 6. Environment variable matrix

**`lyrical-website`** (grepped `process\.env\.[A-Z_0-9]+` across `app/`, `lib/`, `components/`,
`scripts/`, `next.config.ts`, cross-checked against `.env.example`):

| Variable | Documented in `.env.example`? |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | yes |
| `GATE_SECRET` | yes |
| `ENQUIRY_TO_EMAIL`, `ENQUIRY_FROM_EMAIL` | yes |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes |
| `RESEND_API_KEY` | yes |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_SINGLE`, `STRIPE_PRICE_FAN`, `STRIPE_PRICE_SUPERFAN` | yes |
| `INVESTOR_PASSWORD` | yes |
| `ACRCLOUD_HOST`, `ACRCLOUD_ACCESS_KEY`, `ACRCLOUD_SECRET`, `AUDD_API_TOKEN` | yes, but see §10, `ACRCLOUD_SECRET` does not match the name `lyrical-studio` actually reads |
| `INVESTOR_VIDEO_ID`, `INVESTOR_DECK_PATH`, `INVESTOR_DECK_BUCKET` | yes |
| `COFFEY_ORIGINAL_PATH`, `COFFEY_COVER_PATH`, `COFFEY_BUCKET` | yes |
| `SONG_JOB_HOOK_SECRET` | yes |
| `CRON_SECRET` | yes |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **undocumented**, used in `lib/supabase-client.ts` and `lib/supabase-server.ts` |
| `ADMIN_PASSWORD` | **undocumented**, gates `/admin` per `lib/admin-auth.ts` |
| `DEMO_PASSWORD` | **undocumented**, `lib/demo-auth.ts` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | **undocumented**, `lib/turnstile.ts` |
| `NODE_ENV`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` | platform-provided, not something to add to `.env.example`, noted here for completeness only |

**`lyrical-studio`** (grepped `os.environ`, `os.getenv`, and the repo's own `config.get()` /
`config.require()` wrapper across `lyrical/`, `dashboard/`, `scripts/`, cross-checked against
`.env.example`):

| Variable | Documented in `.env.example`? |
|---|---|
| `QOBUZ_USER_ID`, `QOBUZ_AUTH_TOKEN` | yes |
| `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | yes |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DASHSCOPE_API_KEY` | yes |
| `SUNO_RESELLER_PROVIDER`, `SUNO_RESELLER_API_KEY` | yes |
| `LYRICAL_WORK_DIR`, `LYRICAL_DB_PATH` | yes |
| `TRANSLATE_WRITER_A_MODEL`, `TRANSLATE_WRITER_B_MODEL`, `TRANSLATE_SPECIALIST_MODEL`, `TRANSLATE_BACKTRANSLATION_FLOOR`, `TRANSLATE_COMPLETENESS_TOLERANCE` | yes (commented, as override examples) |
| `WEBSITE_SUPABASE_URL`, `WEBSITE_SUPABASE_SERVICE_ROLE_KEY`, `WEBSITE_SUBMISSIONS_BUCKET` | **undocumented**, `dashboard/service/website/config.py`, the pipeline's half of the website contract |
| `ACRCLOUD_HOST`, `ACRCLOUD_ACCESS_KEY`, `ACRCLOUD_ACCESS_SECRET` | **undocumented**, `dashboard/service/website/precheck.py`; note the name is `ACRCLOUD_ACCESS_SECRET` here vs `ACRCLOUD_SECRET` in `lyrical-website/.env.example`, see §10 |
| `MLFLOW_TRACKING_URI`, `LYRICAL_MLFLOW_EXPERIMENT`, `MLFLOW_UI_URL`, `LYRICAL_TRACE` | **undocumented**, `lyrical/translate/tracing.py`, `dashboard/backend/routers/pipeline.py` |
| `SING_W_ALIGNER`, `SING_W_SYLLABLE`, `SING_W_STRESS`, `SING_W_SINGABILITY`, `SING_W_RHYME`, `SING_W_NATIVENESS` | **undocumented**, scoring weight overrides in `lyrical/config.py` |
| `LYRICAL_ASR_DEVICE` | **undocumented**, `lyrical/stages/s7_scorecard/intelligibility.py` |
| `LYRICAL_ESPEAK_DLL`, `PHONEMIZER_ESPEAK_LIBRARY` | **undocumented**, Windows-only espeak-ng path override, `lyrical/config.py` |
| `DASHBOARD_NO_WORKER` | documented in the README's "zero-spend browsing" tip, not in `.env.example` |
| `RENDER_VM_INSTANCE_ID`, `AWS_REGION` | **undocumented**, cold-standby AWS VM wake control (`scripts/set_vercel_env.py` explicitly avoids setting `RENDER_VM_INSTANCE_ID` so the AWS VM does not wake) |

Effort: **S** to write this matrix as its own doc (`docs/env-vars.md` in each repo, or keep it
here and link from both READMEs); the harder follow-up is deciding real values are never
pasted in, only names and one-line purposes, matching the style `.env.example` already uses.
Risk: **none**, this is documentation. Safe without sign-off: **yes**.

## 7. Archive old docs under `docs/history/`

`lyrical-website/docs/` currently has 6 top-level `.md` files. Keep current, archive the rest:

| File | Action |
|---|---|
| `HANDOVER-v3-2026-09-22.md`, `PROMPT-v3-2026-09-22.md` | keep (current, this session's source doc) |
| `HANDOVER.md` (dated 2026-08-04, describes the pre-two-doors funnel site) | move to `docs/history/HANDOVER-2026-08-04.md` |
| `NEXT-SESSION.md` (explicitly says "read HANDOVER.md first") | move to `docs/history/NEXT-SESSION-2026-08-04.md`, same reason, it is a companion to the file above |
| `HANDOVER-v2-businessmodel-2026-09-22.md`, `PROMPT-v2-businessmodel-2026-09-22.md` | **not fully resolved this session**: same-day as the v2 two-doors work but a differently-scoped "business model change + repo consolidation" thread. Not referenced in the v3 handover's reading order. Likely superseded, but ask Henry before archiving rather than assuming; if confirmed superseded, move both to `docs/history/`. |
| `docs/bots/BOT-0..F` (v2 bots, work merged) | move to `docs/history/bots/v2/` |
| `docs/bots/v3/BOT-1..5` (v3 bots, work merged per the v3 handover 2b) | keep in place for now (recent, still the live reference for what shipped), revisit for archival once v3 is fully deployed and verified live |

`lyrical-studio/docs/` currently has 21 files at the top level, almost entirely dated handovers
with no subfolder structure. Concrete list to move to `docs/history/`:

`HANDOVER-2026-08-31.md`, `HANDOVER-2026-09-01-dashboard.md`,
`HANDOVER-2026-09-02-dashboard.md`, `HANDOVER-2026-09-03-independent-stages.md`,
`HANDOVER-2026-09-03-next-speed-and-headless-synthv.md`,
`HANDOVER-2026-09-03-synthv-expression.md`, `HANDOVER-2026-09-07-hosting-exploration.md`,
`HANDOVER-2026-09-07-voice-training-stage6.md`, `HANDOVER-2026-09-08-build-rest.md`,
`PROMPT-2026-09-08-build-rest.md`, `RENDER-SYSTEM-HANDOVER.md`,
`RENDER-WORKER-TOPOLOGY-BRAINSTORM-2026-09-09.md`, `VM-SETUP-HANDOVER-2026-09-09.md`,
`VM-SETUP-PROMPT-2026-09-09.md`, `WEB-STUDIO-DEPLOY-2026-09-10.md`,
`WEB-STUDIO-HANDOVER-2026-09-09.md`, `WEB-STUDIO-SESSION2-HANDOVER-2026-09-09.md`,
`WEBSITE-RENDER-INTEGRATION.md`.

Keep at top level: `ARCHITECTURE.md` (evergreen reference, not a dated handover),
`tracing.md` (evergreen how-to), `WEB-STUDIO-HANDOVER-MASTER-2026-09-17.md` (named "MASTER",
likely the most-current synthesis of the WEB-STUDIO-* thread, confirm with Henry it is current
before archiving the others it supersedes, do not archive it alongside them by pattern-match).

Also note: `deploy/render-pc.md` and `deploy/render-pc-v2.md` both exist. Confirm with Henry
which is current; archive or delete the superseded one rather than leaving two runbooks that
can silently drift apart (an onboarding engineer following the wrong one is exactly the failure
mode this whole clean-up is meant to prevent).

Effort: **S** (file moves, `git mv` to preserve history, plus one clarifying question to Henry
about the v2-businessmodel pair and the two render-pc docs). Risk: **none**, moves not
deletes. Safe without sign-off: **yes** for the unambiguous list; ask first on the two flagged
pairs.

## 8. Naming pass: Lyricall to Lyrical

**Safe to rename** (comments, docs, UI copy, internal identifiers with a small, grepped blast
radius):
- `lyrical/__init__.py` docstring reads `"""Lyricall, AI multilingual music pipeline
  (rebuild)."""` in source (quoted here with the dash replaced by a comma to match this
  document's own no-em-dash rule; the file itself still has the original character).
  Comment only, zero code dependency.
- `lyrical/core/errors.py`: the exception hierarchy is rooted in `class LyricallError`, with
  `ConfigError`, `StageInputError`, `StageExecutionError`, `SourceNotFoundError`,
  `FlaggedError`, `LLMError` all subclassing it. Grepped `LyricallError` across the whole repo:
  used in exactly 2 files, `lyrical/core/errors.py` itself and `tests/test_translate_config.py`.
  Small blast radius, safe to rename to `LyricalError`, catch by both names for one release if
  any external caller might reference it directly (none found in this repo, but the pipeline
  runs standalone code on the render PC not fully visible from here, see §10).
- Scattered comments elsewhere in `lyrical-studio` referencing "Lyricall" as the product name
  (found via the same grep, in `seedvc_modal.py`, `naturalize.py`, `rvc_modal.py`,
  `voices.py`, `lyrics_source.py`, `linematch.py`, `separate_modal.py`) are prose only, safe to
  fix opportunistically when those files are next touched, not urgent enough for a dedicated
  pass.

**Unsafe or needs more care:**
- `lyrical.sqlite` vs `lyricall.sqlite`: **this is not a simple rename, it is a live-data
  question.** Both files exist on disk right now (`lyrical.sqlite`, 76 KB, last modified 30
  Aug; `lyricall.sqlite`, 168 KB, last modified 17 Sep, i.e. newer and larger). The code
  default in `lyrical/config.py` (`LYRICAL_DB_PATH = get("LYRICAL_DB_PATH", "lyrical.sqlite")`)
  points at the OLD file; something is currently overriding `LYRICAL_DB_PATH` to
  `lyricall.sqlite` (present as the documented example value in `.env.example`) to produce the
  newer, larger file actually in use. **Before renaming anything here, confirm with Henry which
  file is the real current database** (very likely `lyricall.sqlite`, given its size and date),
  then either fix the code default to match reality or fix the env override, not both silently.
  This also needs checking on the render PC itself, not just this local copy, since that is
  where the live pipeline runs (not verified this session, flagged in §10).
- The Vercel project that `lyrical-website` deploys to is itself named `lyrical-studio` in its
  domain (`lyrical-studio-omega.vercel.app`, per the v3 handover's own header), which is the
  opposite direction of confusion (the website repo deploying under the studio repo's name).
  Not a "Lyricall" instance, but flagged here because it is the same class of problem: a name
  that does not match the thing it labels, discovered while doing this pass. Renaming a live
  Vercel project's production domain is a DNS/deploy-affecting change and must go through
  Henry, not be done as part of a docs clean-up.
- Package/publish names: `lyrical-website/package.json` name is `lyrical-website` (already
  correct, single L). `lyrical-studio/pyproject.toml` name is `lyrical` (already correct).
  `dashboard/frontend/package.json` name is `lyrical-dashboard-frontend` (already correct).
  None of these need changing; listed here to confirm the check was done, not skipped.
- Database schema/table names in Supabase: grepped `supabase/schema.sql` and
  `supabase/migrations/*.sql` in `lyrical-website` for "lyricall", zero matches. No unsafe
  schema-level renames pending.

Effort: **S** for the confirmed-safe items (docstring + exception class, 2-file blast radius).
**Do not size the sqlite question yet**, it needs Henry's answer first, then it is either
trivial (fix a default) or requires a data migration (if both files hold real, different data
that needs merging). Risk: **low** for the safe items, **medium** for the sqlite question until
answered. Safe without sign-off: safe items yes; the sqlite file and the Vercel project name,
no, ask Henry first.

## 9. Test coverage on money paths

The money-path files already have dedicated tests, more than this plan's brief assumed going
in. Verified by listing `tests/` and checking each file is substantial (not a stub):

| Source file | Test file | Lines (test / source) |
|---|---|---|
| `lib/stripe-webhook.ts` | `tests/stripe-webhook.test.ts`, `tests/stripe-webhook-route.test.ts` | 133 + 108 / 95 |
| `lib/entitlement.ts` | `tests/entitlement.test.ts` | 74 / 60 |
| `lib/entitlement-db.ts` | `tests/stripe-entitlement-db.test.ts` | 79 / 55 |
| `lib/credits.ts` | `tests/stripe-credits.test.ts` | 54 / 35 |
| (Stripe setup script) `scripts/stripe-setup.ts` | `tests/stripe-setup.test.ts` | exists |
| self-serve entitlement gate | `tests/stripe-selfserve-gate.test.ts` | 96 lines |

**What is genuinely missing, per the v3 handover itself:** these are unit tests against mocked
Stripe objects; the actual Stripe checkout flow has never been run, because Henry paused Stripe
and no test keys exist yet (handover section 0: "built, unit-tested, not run: no test keys").
**The real gap is an end-to-end proof run, not unit coverage.** Propose, once Henry supplies
Stripe test keys: a manual (or CI, gated behind a secret Henry provides) run through the actual
Stripe test-mode checkout, webhook delivery, and `song_jobs`/credits ledger update, matching the
"proof run on omega" pattern already used for the pipeline in the v2 spec section 11.

Secondary gap: `lib/webhook` for the pipeline side, `app/api/hooks/song-job/route.ts` and
`app/api/hooks/rating-reminder/route.ts`, do have tests (`tests/song-job-hook-route.test.ts`,
`tests/rating-reminder-route.test.ts`, confirmed present) but these are not strictly "money"
paths (they are delivery/lifecycle hooks), included here only because they share the same
shared-secret auth pattern as the Stripe webhook and are worth the same "has it ever actually
fired against a real header" scrutiny.

Effort: **S** to write down this finding (already mostly done above); **M** for the actual
Stripe test-mode proof run, blocked on Henry supplying keys, not a coding task. Risk: **none**
for documenting current coverage; the proof run itself carries the usual "first real Stripe
test-mode transaction" risk, mitigated by using test mode only. Safe without sign-off: yes to
document; the proof run itself needs Henry's test keys, so it is gated on him regardless.

## 10. Found during exploration, not anticipated by section K

- **`ACRCLOUD_SECRET` (website) vs `ACRCLOUD_ACCESS_SECRET` (studio) name mismatch.** The two
  repos are meant to share this contract (Door 2 copyright fingerprinting, section H of the v3
  handover) but currently use different env var names for the same secret. Neither app has
  wired a real client yet (Henry has no ACRCloud trial as of 22 Sep, per `.env.example`'s own
  comment), so nothing is broken in production today, but whoever sets this up next will set
  one and the other app will silently read an empty string. Fix: pick one name (recommend
  `ACRCLOUD_ACCESS_SECRET`, matching the code that already exists in `lyrical-studio`) and
  update `lyrical-website/.env.example` to match before this ships. Effort **S**, risk none
  (nothing live depends on the current name yet).
- **Undocumented env vars, both repos.** See the full matrix in §6; roughly a dozen real vars
  in `lyrical-studio` alone (`MLFLOW_*`, `SING_W_*`, `LYRICAL_ASR_DEVICE`,
  `LYRICAL_ESPEAK_DLL`, `WEBSITE_SUPABASE_*`, `RENDER_VM_INSTANCE_ID`) have no line in
  `.env.example`. A new engineer reading only `.env.example` would not know these exist.
- **`lyrical.sqlite` / `lyricall.sqlite` divergence**, covered in §8, repeated here because it
  is as much a "nobody noticed this drifted" finding as a naming one: the code's own default
  points at a file that is not the one actually being written to.
- **Two `deploy/render-pc*.md` runbooks** (`render-pc.md`, `render-pc-v2.md`) with no marker
  for which is current, covered in §7.
- **The render PC itself was not inspected.** Section K's brief specifically calls out
  "untracked helper scripts on the render PC" as a dead-code candidate; this machine only has
  a local copy of `lyrical-studio` on `main`, not shell access to 192.168.86.31. The two
  untracked scripts found and documented in §4 (`set_auth_redirects.py`, `set_vercel_env.py`)
  are on THIS machine, not confirmed to be the same or the only untracked scripts on the render
  PC itself. **Anyone acting on this plan needs a pass on the actual render PC** (remote
  session or Henry's own look) to complete this part of section K; it cannot be done from here.
- **`.deploy-payload.min.json`** at the `lyrical-website` repo root (457 KB, present on disk,
  not reviewed in structure listings above): worth a look, a minified JSON blob this size at
  repo root sitting alongside `.env.example` is unusual; confirm what it is (looks like a
  Vercel deploy payload dump from `process.env.*` references found inside it during the env-var
  grep) and whether it belongs in `.gitignore` rather than on disk uncommitted or tracked.
  **Not fully investigated this session, flagging for the next pass.**
- **No `.github/workflows/` in either repo**, confirmed absent (§5), not a surprise given
  section K asked for it, listed here only for completeness of the "what did I check" record.
- **Lockfiles:** `lyrical-website` uses `package-lock.json` (npm), `dashboard/frontend` in
  `lyrical-studio` also uses `package-lock.json` (npm), consistent. No poetry/Pipfile lock
  found for the Python side (pip + `requirements.txt` only); not itself a problem, just noted
  since the task asked to check for lockfile inconsistency and none was found.
- **Secrets in git history:** not checked this session (would need a full-history grep of both
  repos, e.g. `git log -p | grep`, which is a heavier operation than this planning pass
  covered). **Explicitly unverified, recommend as a follow-up task**, especially given
  `lyrical-studio` has a documented pattern of gitignored token files
  (`scripts/.supabase_token`, `scripts/.vercel_token`) which implies real tokens have existed
  on this machine, worth confirming none were ever committed before the `.gitignore` line was
  added.

Effort: varies per item, most are **S**. Risk: the secrets-in-history check, if it turns
something up, could be **high**; everything else here is low-risk documentation or a single
config-value fix. Safe without sign-off: the ACRCLOUD name fix and the undocumented-env-var
docs, yes; the secrets-in-history check should happen before anything else here is treated as
closed out, and Henry should know regardless of the result.
