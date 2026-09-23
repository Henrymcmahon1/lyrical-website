# Bot C: the render PC poller adopts the contract

**Paste this to start:** "You are Bot C (Phase 1). Read
`C:\Users\User\CascadeProjects\lyrical-website\docs\bots\phase1\README.md` then this brief. Work in
`C:\Users\User\CascadeProjects\lyrical-studio` (GitHub: lyrical-pipeline) in a new worktree
`C:\Users\User\CascadeProjects\wt\p1-poller-contract` on branch `feat/p1-poller-contract` off `main`.
Commit on your branch only, never push, never touch the OptiPlex."

## Build
1. Copy `supabase/generated/contract.py` from the website repo (merged `develop`) to
   `dashboard/service/website/contract.py` with a header naming its source and `npm run db:types`.
   A test asserts the copy matches the source file byte for byte when the website repo is present
   next door (skip with a clear message otherwise).
2. `models.py`: `WebsiteJob`/`WebsiteAsset` fields typed with the contract enums; `from_row` rejects
   an unknown enum value or an unknown `contract_version` loudly.
3. `client.py`: `claim()` calls the `claim_song_job` RPC with a worker id (hostname + pid) instead
   of the conditional PATCH; `next_queued_job()` calls `next_queued_song_job`. Every other write uses
   the enum values. Delete the duplicated state tuples (`_PENDING_PIPELINE_STATES`, the terminal
   sets in `poller.py` and `service/runs.py` that mean pipeline states) in favour of the contract.
4. `scripts/requeue_job.py` uses the enum too.
5. Tests with fakes only (no Supabase, no Modal): RPC call shape, unknown enum / version refusal,
   claim false when another worker won.

## Done when
Full suite green (report counts; note the 8 skipped), no bare pipeline-state strings left outside
`contract.py` (grep and report), PR lists the OptiPlex deploy steps (bundle + scp + restart
LyricalPoller) and that it must ship AFTER the production contract migration.
