# v2 bot briefs (two doors), 22 Sep 2026

Spec: `docs/superpowers/specs/2026-09-22-two-doors-v2-design.md`. Design page: https://claude.ai/artifact/Rgk8kaYBHb8JaPHnYqEmRS

Each brief stands alone. Open a fresh Claude session per bot and paste the "Paste this to start" block from the top of its file.

| Order | Bot | File | Repo / branch | Runs |
|---|---|---|---|---|
| 1 | 0 Prep | `BOT-0-prep.md` | lyrical-website `feat/v2-prep` | alone, first |
| 2 | A Payments | `BOT-A-payments.md` | lyrical-website `feat/v2-payments` | parallel |
| 2 | B Marketing | `BOT-B-marketing.md` | lyrical-website `feat/v2-marketing` | parallel |
| 2 | C Studio | `BOT-C-studio.md` | lyrical-website `feat/v2-studio` | parallel |
| 2 | D Artists | `BOT-D-artists.md` | lyrical-website `feat/v2-artists` | parallel |
| 2 | F Pipeline | `BOT-F-pipeline.md` | lyrical-studio `feat/v2-pipeline` | parallel |
| 3 | E Ops | `BOT-E-ops.md` | lyrical-studio `feat/v2-ops` | after F (purge), rest any time |

Merge order into `develop`: A, C, B, D. Then F deploys to the OptiPlex, then E, then the proof run (spec §11).

Rules every bot carries: never touch `main` of lyrical-website or lyricalglobal.com; no em dashes; no secrets typed into files; one poller only; `npm test && npm run build` (web) or `pytest` (pipeline) green before a PR.

What Henry owns (spec §14): Stripe test keys + webhook secret + price ids into the omega Vercel env; the Coffey Anderson files and their path; `INVESTOR_PASSWORD`; the Supabase plan confirmation; a "go" on the purge dry-run list.
