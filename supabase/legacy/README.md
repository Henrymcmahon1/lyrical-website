# supabase/legacy: history only

Do not run anything in this folder. Do not edit it.

Until 24 Sep 2026 the schema was kept by hand: `schema.sql` was pasted into the Supabase SQL
editor, and `001`..`008` were the same changes as numbered files. They drifted from production in
places (three columns the site depends on, `pipeline_state`, `pipeline_error` and `route`, were
defined in the render PC repo, not here).

The source of truth is now the Supabase CLI:

- `supabase/migrations/<ts>_remote_baseline.sql`: `supabase db pull` of production, which
  contains everything these files did (and what they missed).
- `supabase/migrations/<ts>_*.sql`: every change since, applied in filename order.
- `supabase/tests/*.sql`: pgTAP proofs, `npx supabase test db`.
- `docs/CONTRACT.md`: the job contract in plain words.

These files are kept so `git log` and old handover notes still resolve.
