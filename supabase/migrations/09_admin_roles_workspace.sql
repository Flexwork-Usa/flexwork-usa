-- Admin role hierarchy, work logs, payouts, worker earnings helpers.

-- ---------------------------------------------------------------------------
-- Admin roles
-- ---------------------------------------------------------------------------
alter table public.admin_users add column if not exists role text not null default 'admin';
alter table public.admin_users add column if not exists created_by uuid references public.admin_users (id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admin_users_role_check') then
    alter table public.admin_users
      add constraint admin_users_role_check
      check (role in ('super_admin', 'admin', 'worker_admin'));
  end if;
end $$;

-- Seed / promote blackman as super_admin when present
update public.admin_users
set role = 'super_admin'
where lower(coalesce(email, '')) = 'blackmanochieng@gmail.com';

-- Worker admins are identified via profiles.role = 'worker_admin' (see migration 12).
alter table public.profiles add column if not exists total_earnings numeric not null default 0;
alter table public.profiles add column if not exists total_tokens_spent numeric not null default 0;

-- ---------------------------------------------------------------------------
-- Hourly work logs
-- ---------------------------------------------------------------------------
create table if not exists public.hourly_work_logs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  elapsed_seconds integer not null default 0,
  is_running boolean not null default false,
  last_heartbeat_at timestamptz not null default now(),
  idle_warnings integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hourly_work_logs_worker_id_idx on public.hourly_work_logs (worker_id);
create index if not exists hourly_work_logs_application_id_idx on public.hourly_work_logs (application_id);

alter table public.hourly_work_logs enable row level security;
grant select, insert, update on table public.hourly_work_logs to authenticated;

drop policy if exists "Workers manage own hourly logs" on public.hourly_work_logs;
create policy "Workers manage own hourly logs"
  on public.hourly_work_logs for all to authenticated
  using (worker_id = auth.uid())
  with check (worker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Quota deliverables
-- ---------------------------------------------------------------------------
create table if not exists public.quota_submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid,
  deliverable_text text not null,
  deadline_at timestamptz,
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'rejected', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quota_submissions_worker_id_idx on public.quota_submissions (worker_id);

alter table public.quota_submissions enable row level security;
grant select, insert, update on table public.quota_submissions to authenticated;

drop policy if exists "Workers manage own quota submissions" on public.quota_submissions;
create policy "Workers manage own quota submissions"
  on public.quota_submissions for all to authenticated
  using (worker_id = auth.uid())
  with check (worker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Payout requests
-- ---------------------------------------------------------------------------
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles (id) on delete cascade,
  method text not null check (method in ('crypto', 'airtm', 'paypal')),
  amount_usd numeric not null check (amount_usd >= 50),
  destination text not null,
  network text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'paid')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payout_requests_worker_id_idx on public.payout_requests (worker_id);
create index if not exists payout_requests_status_idx on public.payout_requests (status);

alter table public.payout_requests enable row level security;
grant select, insert on table public.payout_requests to authenticated;

drop policy if exists "Workers can read own payouts" on public.payout_requests;
create policy "Workers can read own payouts"
  on public.payout_requests for select to authenticated
  using (worker_id = auth.uid());

drop policy if exists "Workers can create own payouts" on public.payout_requests;
create policy "Workers can create own payouts"
  on public.payout_requests for insert to authenticated
  with check (worker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Analytics helpers (service role reads these freely)
-- ---------------------------------------------------------------------------
create or replace view public.admin_pipeline_funnel as
select
  status,
  count(*)::integer as count
from public.applications
group by status;

create or replace view public.admin_daily_activity as
select
  day::date as day,
  coalesce(sum(applications), 0)::integer as jobs_applied,
  coalesce(sum(payouts), 0)::integer as payouts
from (
  select date_trunc('day', submitted_at) as day, count(*) as applications, 0 as payouts
  from public.applications
  where submitted_at >= now() - interval '30 days'
  group by 1
  union all
  select date_trunc('day', created_at) as day, 0 as applications, count(*) as payouts
  from public.payout_requests
  where created_at >= now() - interval '30 days'
  group by 1
) t
group by 1
order by 1;
