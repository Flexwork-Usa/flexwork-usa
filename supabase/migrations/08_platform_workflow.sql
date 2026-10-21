-- Platform workflow: treasury deposits, applications bidding, moderation, leaderboard.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists last_password_change_at timestamptz;
alter table public.profiles alter column token_balance set default 50;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_status_check
      check (status in ('active', 'under_review', 'temp_disabled', 'banned'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Treasury
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_addresses (
  id uuid primary key default gen_random_uuid(),
  network text not null check (network in ('TRC20', 'ERC20', 'BEP20')),
  address text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.treasury_deposits (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles (id) on delete cascade,
  usdt_amount numeric not null check (usdt_amount > 0),
  tokens_issued numeric not null check (tokens_issued > 0),
  deposit_address text not null,
  memo_code text not null unique,
  tx_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists treasury_deposits_worker_id_idx on public.treasury_deposits (worker_id);
create index if not exists treasury_deposits_status_idx on public.treasury_deposits (status);
create index if not exists treasury_deposits_memo_code_idx on public.treasury_deposits (memo_code);

alter table public.treasury_addresses enable row level security;
alter table public.treasury_deposits enable row level security;

grant select on table public.treasury_addresses to authenticated, anon;
grant select, insert, update on table public.treasury_deposits to authenticated;

drop policy if exists "Anyone can read active treasury addresses" on public.treasury_addresses;
create policy "Anyone can read active treasury addresses"
  on public.treasury_addresses for select to authenticated, anon
  using (is_active = true);

drop policy if exists "Workers can read own treasury deposits" on public.treasury_deposits;
create policy "Workers can read own treasury deposits"
  on public.treasury_deposits for select to authenticated
  using (worker_id = auth.uid());

drop policy if exists "Workers can create own treasury deposits" on public.treasury_deposits;
create policy "Workers can create own treasury deposits"
  on public.treasury_deposits for insert to authenticated
  with check (worker_id = auth.uid());

drop policy if exists "Workers can update own pending treasury deposits" on public.treasury_deposits;
create policy "Workers can update own pending treasury deposits"
  on public.treasury_deposits for update to authenticated
  using (worker_id = auth.uid() and status = 'pending')
  with check (worker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Jobs extensions
-- ---------------------------------------------------------------------------
alter table public.jobs add column if not exists category text not null default 'General';
alter table public.jobs add column if not exists pay_type text not null default 'hourly';
alter table public.jobs add column if not exists slots_needed integer not null default 10;
alter table public.jobs add column if not exists hiring_status text not null default 'hiring';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_pay_type_check') then
    alter table public.jobs
      add constraint jobs_pay_type_check check (pay_type in ('hourly', 'quota'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_hiring_status_check') then
    alter table public.jobs
      add constraint jobs_hiring_status_check check (hiring_status in ('hiring', 'paused', 'closed'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Applications (priority bidding)
-- ---------------------------------------------------------------------------
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  tokens_staked numeric not null default 5 check (tokens_staked >= 5),
  status text not null default 'submitted'
    check (status in ('submitted', 'viewed', 'under_review', 'hired', 'rejected')),
  proof_data text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, worker_id)
);

create index if not exists applications_job_id_idx on public.applications (job_id);
create index if not exists applications_worker_id_idx on public.applications (worker_id);

alter table public.applications enable row level security;
grant select, insert, update on table public.applications to authenticated;

drop policy if exists "Workers can read own applications" on public.applications;
create policy "Workers can read own applications"
  on public.applications for select to authenticated
  using (worker_id = auth.uid());

drop policy if exists "Workers can create own applications" on public.applications;
create policy "Workers can create own applications"
  on public.applications for insert to authenticated
  with check (worker_id = auth.uid());

drop policy if exists "Workers can update own applications" on public.applications;
create policy "Workers can update own applications"
  on public.applications for update to authenticated
  using (worker_id = auth.uid())
  with check (worker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Leaderboard
-- ---------------------------------------------------------------------------
create table if not exists public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  worker_name text not null,
  email_masked text not null,
  country text not null default '',
  skill text not null default '',
  total_earnings numeric not null default 0,
  rank_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leaderboard_rank_order_idx on public.leaderboard (rank_order);

alter table public.leaderboard enable row level security;
grant select on table public.leaderboard to authenticated, anon;

drop policy if exists "Anyone can read leaderboard" on public.leaderboard;
create policy "Anyone can read leaderboard"
  on public.leaderboard for select to authenticated, anon
  using (true);

-- ---------------------------------------------------------------------------
-- Helper: memo codes
-- ---------------------------------------------------------------------------
create or replace function public.generate_deposit_memo()
returns text
language plpgsql
as $$
declare
  code text;
begin
  loop
    code := 'FW-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.treasury_deposits where memo_code = code and status = 'pending');
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sign-up / profile defaults: 50 token bonus when approved profile is created
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_profile_token_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.token_balance is null or new.token_balance = 0 then
    new.token_balance := 50;
  end if;
  if new.status is null or new.status = '' then
    new.status := 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_token_bonus_bi on public.profiles;
create trigger profiles_token_bonus_bi
  before insert on public.profiles
  for each row execute function public.handle_new_profile_token_bonus();

-- ---------------------------------------------------------------------------
-- Password change lock (24h)
-- ---------------------------------------------------------------------------
create or replace function public.can_change_password(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select last_password_change_at is null
        or last_password_change_at <= now() - interval '24 hours'
      from public.profiles
      where id = p_user_id
    ),
    true
  );
$$;

revoke all on function public.can_change_password(uuid) from public;
grant execute on function public.can_change_password(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Application rank view
-- ---------------------------------------------------------------------------
create or replace view public.application_ranks as
select
  a.*,
  dense_rank() over (
    partition by a.job_id
    order by a.tokens_staked desc, a.submitted_at asc
  ) as rank_position,
  count(*) over (partition by a.job_id) as applicant_count
from public.applications a;

grant select on public.application_ranks to authenticated;

-- ---------------------------------------------------------------------------
-- Expire pending treasury deposits
-- ---------------------------------------------------------------------------
create or replace function public.expire_treasury_deposits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.treasury_deposits
  set status = 'expired', updated_at = now()
  where status = 'pending' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Seed a few treasury addresses if empty
insert into public.treasury_addresses (network, address, is_active)
select *
from (
  values
    ('TRC20', 'TPendingAssignment000000000000000001', true),
    ('ERC20', '0xPendingAssignment00000000000000000001', true),
    ('BEP20', '0xPendingAssignmentBnb00000000000000001', true)
) as seed(network, address, is_active)
where not exists (select 1 from public.treasury_addresses);
