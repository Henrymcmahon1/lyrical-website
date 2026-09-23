# Paste this to start the Door 1 admin session

We are building a SEPARATE, admin-only web dashboard on omega for the Door 1 (signed-artist) product:
a management console to create, track and deliver Door 1 jobs, plus the CRM, kept distinct from the
Door 2 customer studio. The render stays on the OptiPlex render PC; the web is only a control surface.

Website work is on the **`develop`** branch of `C:\Users\User\CascadeProjects\lyrical-website`
(deploys to https://lyrical-studio-omega.vercel.app, which is the `lyrical-studio` Vercel project).
Pipeline/poller work is on **`main`** of `C:\Users\User\CascadeProjects\lyrical-studio` (runs on the
OptiPlex, 192.168.86.31). **Never touch `main` of lyrical-website or lyricalglobal.com, and never
deploy the separate `lyrical-website` Vercel project.**

Read first, in order:
1. `docs/HANDOVER-door1-admin-2026-09-24.md`
2. `docs/DOOR1-ADMIN-PLAN.md` (the build brief: locked decisions, the four build steps, the proof run)
3. `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md` (24 Sep decision-log entry)
4. Memory: `lyrical-two-doors-v2`, `lyrical-render-optiplex`, `lyrical-two-sites-boundary`,
   `vercel-hobby-daily-cron`

Locked decisions (do not reopen): management console only (craft tools stay on the local render-PC
dashboard); admin account info@lyricalglobal.com only; renderer is the OptiPlex via the poller and
the Supabase contract (`delivery_profile='door1'`, `export_door1.py` already exists); proper Supabase
admin auth with an email allowlist + 2FA replaces the shared ADMIN_PASSWORD and is done FIRST.

Do NOT start building. First confirm anything the plan marks as my call (auth details, the Door 1
job-form fields, and the WAV-stem storage/retention approach given Supabase is near its free tier),
via AskUserQuestion (multiple choice, never a bare list). Then plan the parallel bots as the handover
section 5 lays out, one brief per bot under `docs/bots/door1/`, run them in worktrees, and review
every PR before merging. Deploy the website via the deploy hook (Hobby crons must stay daily), the
pipeline via scp + poller restart. Keep the handover and the spec decision log updated as decisions
happen. No em dashes anywhere.
