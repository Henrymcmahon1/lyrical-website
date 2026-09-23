# Handover: Door 1 admin web dashboard (next session)

**Written 2026-09-24 for a fresh session.** Goal of the next session: build a SEPARATE, admin-only
web dashboard on omega for the Door 1 (signed-artist) product, a management console (create / track
/ deliver Door 1 jobs + CRM), distinct from the Door 2 customer studio. The render stays on the
OptiPlex; the web is only a control surface.

Read in this order:
1. This handover.
2. `docs/DOOR1-ADMIN-PLAN.md` (the detailed build plan: locked decisions, the 4 build steps, the
   proof run, watch-outs). THIS IS THE BRIEF.
3. `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` (architecture, data model, decision
   log, esp. the 24 Sep entry).
4. Memory: `lyrical-two-doors-v2`, `lyrical-render-optiplex`, `lyrical-two-sites-boundary`,
   `vercel-hobby-daily-cron`.

---

## 0. Repos, deploy, infra (verified this session)
- Website: `C:\Users\User\CascadeProjects\lyrical-website`, branch **`develop`** (head `6ca1e3a`).
  Deploys to https://lyrical-studio-omega.vercel.app. **Never touch `main` of lyrical-website or
  lyricalglobal.com** (that is the separate live `lyrical-website` Vercel project = real clients).
- Pipeline: `C:\Users\User\CascadeProjects\lyrical-studio`, branch **`main`**, runs on the OptiPlex
  render PC (192.168.86.31, key `lyrical_render_pc`). SynthV's GPU is HERE; the AWS VM is cold
  standby only.
- **omega = the `lyrical-studio` Vercel project** (id `prj_LP1k6o2pomhavFKlXZQEobM4mrMQ`, team `hjam`
  / `team_WRz5N4YIo80jdQVmbFfLT0cL`), production branch `develop`. The OTHER Vercel project,
  `lyrical-website`, serves lyricalglobal.com from `main`: NEVER deploy to it.
- Supabase live project: `hikvjnpkvnxibfzdnpig`.
- **Deploy path that works:** push `develop`, then fire the deploy hook
  `POST https://api.vercel.com/v1/integrations/deploy/prj_LP1k6o2pomhavFKlXZQEobM4mrMQ/XCDLwZbpPX`.
  GOTCHA: Vercel Hobby allows only DAILY crons; a sub-daily cron in `vercel.json` silently blocks
  EVERY deploy (see [[vercel-hobby-daily-cron]]). `npm run build` needs a gitignored `.env.local`
  with placeholder `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` for prerender; never commit it.
- Migrations are applied by driving the Supabase SQL editor in Henry's signed-in Chrome
  (claude-in-chrome), one file at a time, then verified. Trick: set the query via
  `monaco.editor.getModels()[0].setValue(...)` to dodge the editor's bracket auto-close, then click Run.

## 1. What is LIVE on omega now (all v3 shipped this session)
6-digit email code sign-in + Google; automatic emails (welcome, track delivered, re-roll delivered,
not-made, rating reminder, enquiry/EOI ack) with mockups; the `/admin` CRM console (People, Money,
Work, Voice, Relationships, Issues, re-queue) gated by `ADMIN_PASSWORD`, with `/queue` folded in;
`/studio/account` (editable name, email prefs, data export, soft delete); collapsible song cards;
per-song earnings calculator with a cumulative 5-year LINE graph (no NPV); home "Want more?" section;
`/hear` folded into home; Turnstile on public forms only (off post-sign-in); enriched `/pricing`
(struck $2,000 vs from $9 + reassurance strip); warmed `/artists` with a Coffey before/after hero
slot; mission-led `/about`. Migrations 004/004b/005/006 applied to production. Studio stays DARK
(a light retheme was tried and rejected). A post-sign-in 500 (a function prop passed to a client
component) was found and fixed.

## 2. The Door 1 task: locked decisions (Henry, 24 Sep)
- **Management console only.** Create Door 1 jobs, track status, deliver 24-bit WAV stems, CRM. The
  craft tools (stage runs, live logs, waveform A/B, render knobs, voice-model training) STAY on the
  local render-PC dashboard (`lyrical-studio/dashboard`). Do not rebuild those on the web.
- **Separate from Door 2.** Door 2 = customer studio `/studio` (customer auth). Door 1 = admin-only
  surface. Keep them distinct.
- **Admin account only:** info@lyricalglobal.com.
- **Renderer: the OptiPlex (as now)** via the poller + the Supabase `song_jobs` contract with
  `delivery_profile='door1'`. `dashboard/service/export_door1.py` already makes the 24-bit
  vocal/instrumental/mix stems from Stage 6.
- **Proper admin auth first:** replace the shared `ADMIN_PASSWORD` with a real Supabase identity
  restricted to an allowlist (info@lyricalglobal.com), ideally 2FA. This gates everything and also
  hardens the existing `/admin`. Difficulty overall: MODERATE (the plumbing is proven).
- Build steps, proof run, and watch-outs (esp. WAV storage cost vs the near-full Supabase free tier):
  see `docs/DOOR1-ADMIN-PLAN.md`.

## 3. Rules carried forward
Never `main` of lyrical-website or lyricalglobal.com; never deploy the `lyrical-website` Vercel
project. No em dashes anywhere (code, comments, copy, commits). Secrets only via Vercel env or
gitignored files; the bot never types keys. `song_jobs` has column-level SELECT grants: never
`select *` on a customer path; new customer-readable columns must be added to the grant. Never pass a
FUNCTION as a prop from a server component to a client component (it 500s the page; pass serializable
data). One poller only on the OptiPlex. Fail loud. `npm test && npm run build` green before any PR.
Verify before claiming done. Questions to Henry via multiple choice.

## 4. Henry owns (unblocked to start; these are for later polish, not Door 1)
The real `/about` origin story (an invented one was removed); the Coffey before/after files
(COFFEY_* env) so the /artists + home slots render; `INVESTOR_VIDEO_ID` + deck path when they exist;
an ACRCloud trial for copyright phase 2. For Door 1 specifically: nothing upfront beyond the auth
identity, which the session sets up with him.

## 5. Suggested execution (parallel, as prior sessions)
Auth upgrade FIRST (bot A) since it gates the surface. Then in parallel: bot B = Door 1 create +
deliver UI on the website (own worktree/branch off develop); bot C = the poller door1 render +
export + upload path on lyrical-studio (own branch off main). Each in its own git worktree, PR into
its branch, reviewed before merge, deployed via the hook (website) or scp + poller restart
(pipeline). Then the proof run in `docs/DOOR1-ADMIN-PLAN.md`.
