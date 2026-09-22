create table if not exists public.crm_notes (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author     text,                         -- staff label, free text (no staff auth yet)
  user_id    uuid references auth.users (id) on delete cascade,
  enquiry_id uuid references public.enquiries (id) on delete cascade,
  body       text not null,
  constraint crm_notes_target check (user_id is not null or enquiry_id is not null)
);
create index if not exists crm_notes_user_idx on public.crm_notes (user_id, created_at desc);
create index if not exists crm_notes_enquiry_idx on public.crm_notes (enquiry_id, created_at desc);

create table if not exists public.crm_tasks (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users (id) on delete set null,
  enquiry_id uuid references public.enquiries (id) on delete set null,
  title      text not null,
  due_on     date,
  owner      text,
  done_at    timestamptz
);
create index if not exists crm_tasks_open_idx on public.crm_tasks (done_at, due_on);

create table if not exists public.crm_issues (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id     uuid references public.song_jobs (id) on delete set null,
  user_id    uuid references auth.users (id) on delete set null,
  kind       text not null,                -- failed_job | refund | complaint | other
  status     text not null default 'open' check (status in ('open','ack','resolved')),
  detail     text,
  resolved_at timestamptz
);
create index if not exists crm_issues_status_idx on public.crm_issues (status, created_at desc);

-- Relationship status on enquiries (EOIs and enquiries share this table).
alter table public.enquiries add column if not exists rel_status text
  check (rel_status in ('new','contacted','in_talks','signed','closed'));
alter table public.enquiries add column if not exists rel_owner text;

alter table public.crm_notes  enable row level security;  -- service role only, no policies
alter table public.crm_tasks  enable row level security;
alter table public.crm_issues enable row level security;
