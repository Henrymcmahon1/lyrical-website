# Bot A: the job contract in the database

**Paste this to start:** "You are Bot A (Phase 1). Read `docs/bots/phase1/README.md` (THE CONTRACT)
then this brief, in `C:\Users\User\CascadeProjects\lyrical-website`. Work in a new worktree
`C:\Users\User\CascadeProjects\wt\p1-contract` on branch `feat/p1-contract` off `develop`. Commit on
your branch only, never push. Never touch production Supabase except READ-ONLY `supabase db pull` and
read-only queries."

## Preconditions (the orchestrator confirms before starting you)
Docker Desktop running; `npx supabase` logged in; the repo linked to production
(`hikvjnpkvnxibfzdnpig`). If any is missing, stop and report; do not work around it.

## Build
1. `npx supabase init` if needed (keep `config.toml` minimal), then `npx supabase db pull` into
   `supabase/migrations/<ts>_remote_baseline.sql`. Read it: it must contain `pipeline_state`,
   `pipeline_error`, `route`, the buckets and every policy. Move `001`..`008` and `schema.sql` to
   `supabase/legacy/` with a README. Update anything that reads `schema.sql`
   (`scripts/verify-schema.ts`, tests such as `tests/door1-migration.test.ts`,
   `tests/customer-job-insert-lock.test.ts`): point them at the new migrations or retire them with a
   note, never leave them silently skipped.
2. `npx supabase start` and `npx supabase db reset`: the baseline must apply cleanly to an empty stack.
3. Read-only against production: distinct values of `status`, `pipeline_state`, `route`,
   `delivery_profile` on `song_jobs`. Put the query and result in the PR. Stop on any surprise.
4. `<ts>_job_contract.sql`: enums, CHECK on `status`, the transition trigger, `contract_version`,
   `claimed_by`, `claimed_at`, `claim_song_job`, `next_queued_song_job`, grants. Idempotent where
   Postgres allows. Re-grep both repos for every `pipeline_state` writer and list them in the PR
   against the transition table.
5. Database tests in `supabase/tests/` (pgTAP via `npx supabase test db`): every allowed transition
   passes, every forbidden one raises; claim is exclusive (second claim returns false); anon and
   authenticated cannot execute the RPCs; customer insert lock from migration 008 still holds.
6. Generated code: `lib/db/database.types.ts`, `supabase/generated/contract.py`, and
   `npm run db:types`. A vitest test that regenerates into a temp file and diffs (skip with a clear
   message when the local stack is not running, and make CI note it).
7. `docs/CONTRACT.md` as specified in the README.

## Done when
Baseline + contract apply cleanly to a fresh local stack; pgTAP green; `npm test && npm run build`
green; PR lists: the production distinct-values result, the writer-to-transition table, exact test
counts, and the exact SQL the orchestrator applies to `lyrical-test` then production.
