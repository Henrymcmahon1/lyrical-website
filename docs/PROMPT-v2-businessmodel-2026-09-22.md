# Paste this to start the next session

We're making a big business-model change to Lyrical: "one technology, two doors" (Door 1 = signed
artists, 30% perpetual royalty, human-in-loop, lossless stems, the moat; Door 2 = self-serve fan toy
in beta, 3 subscription plans, capped MP3, the flywheel). All work happens on the **`develop`** branch
of `C:\Users\User\CascadeProjects\lyrical-website`, which deploys to
**https://lyrical-studio-omega.vercel.app**. The LIVE site (`main` / lyricalglobal.com) must NOT be
touched.

**Read first, in order:**
1. `C:\Users\User\CascadeProjects\lyrical-website\docs\HANDOVER-v2-businessmodel-2026-09-22.md`
   (full state, my senior-engineer take on the repo-structure question, the vision, the task list,
   constraints, addresses, and a suggested parallel-task breakdown).
2. The vision artifact: https://claude.ai/artifact/Pkzb6YouK4nJRSbqpdQsHS
3. Your memory notes: `lyrical-two-sites-boundary`, `lyrical-render-optiplex`,
   `lyrical-studio-selfserve-dev`, `lyrical-poller-worker-fix`, `synthv-recovery-false-positive`.

**Do NOT start building.** Henry wants you to: **look → think → ask him questions (via AskUserQuestion,
multiple choice — never a bare list) → then plan, design, and break the work into tasks for several
bots.** Key decisions to surface include: the repo structure (do NOT copy the Python pipeline into the
web repo — see the handover §1 for why, and the A/B/C options for where the internal Door-1 dashboard
lives); Door-1 on the website = EOI vs an artist earnings calculator; investor page yes/no; Stripe
test-vs-live; Supabase storage retention. Flag early that Stripe/GitHub connectors need Henry to
authorize them.

Open question Henry asked me and I answered in the handover (§1): "should we copy `lyrical-studio` into
`lyrical-website`?" — my answer is **no, not the Python pipeline**; separate by concern. Confirm the
direction with him before restructuring anything.
