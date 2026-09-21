-- 003: render-worker heartbeat, upserted by the OptiPlex poller every loop.
-- The studio reads it to say whether renders are running. Anyone may read; only the
-- service role writes.
create table if not exists public.worker_heartbeat (
  worker   text primary key,
  seen_at  timestamptz not null default now(),
  version  text
);
alter table public.worker_heartbeat enable row level security;
drop policy if exists worker_heartbeat_read on public.worker_heartbeat;
create policy worker_heartbeat_read on public.worker_heartbeat for select using (true);
