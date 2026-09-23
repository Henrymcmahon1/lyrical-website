# Bot B: the website adopts the contract

**Paste this to start:** "You are Bot B (Phase 1). Read `docs/bots/phase1/README.md` then this
brief, in `C:\Users\User\CascadeProjects\lyrical-website`. Work in a new worktree
`C:\Users\User\CascadeProjects\wt\p1-web-types` on branch `feat/p1-web-types` off the CURRENT
`develop` (Bot A is merged). Commit on your branch only, never push."

## Build
1. Typed Supabase clients: `supabaseServer`, `supabaseBrowser`, `supabaseAdmin` take the generated
   `Database` type. Fix every type error that surfaces; do not cast them away.
2. Replace the hand-written job row types (`Job` in `app/admin/SongsTab.tsx` and
   `app/admin/door1/[id]/page.tsx`, `SongJob` in `SongCard.tsx`, `SongJobRecord` in
   `lib/song-job-hook.ts`, `SongJobEmailFields`, and any others: find them all) with types derived
   from `Database['public']['Tables']['song_jobs']['Row']` via `Pick`.
3. `lib/jobs/states.ts`: the ONE place for job-state logic on the web: the status move graph (moved
   from `lib/job-transitions.ts`), pipeline-state labels (moved from `app/admin/door1/shared.tsx`
   `stateLabel`), both typed from the generated enums. UI labels stay separate from the graph.
4. Remove every `as X` / `as unknown as X` cast on Supabase results that the generated types make
   unnecessary. Report the before and after count.
5. Every insert or update that sets `pipeline_state`, `route` or `delivery_profile` uses the typed
   enum values; a typo must fail the build.

## Watch-outs
Behaviour must not change: same queries, same columns, same UI. Never `select *` on a customer path.
Never pass a function prop from a server to a client component.

## Done when
`npm test && npm run build` green, lint 0 errors, cast count reported, PR lists every file touched.
