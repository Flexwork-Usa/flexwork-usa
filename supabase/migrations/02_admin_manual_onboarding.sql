-- Manual onboarding, worker profiles, and token ledger.

create table if not exists public.onboarding_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  country text not null,
  phone_number text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  country text,
  phone_number text,
  wallet_usdt_tron text, -- USDT (TRC-20)
  wallet_usdt_eth text,  -- USDT (ERC-20)
  wallet_usdc_eth text,  -- USDC (ERC-20)
  token_balance integer not null default 0,
  role text not null default 'worker',
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists wallet_usdt_tron text;
alter table public.profiles add column if not exists wallet_usdt_eth text;
alter table public.profiles add column if not exists wallet_usdc_eth text;
alter table public.profiles add column if not exists token_balance integer not null default 0;
alter table public.profiles add column if not exists role text not null default 'worker';
alter table public.profiles add column if not exists is_approved boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'profiles'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) ilike '%REFERENCES auth.users%'
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users (id) on delete cascade;
  end if;
end $$;

create table if not exists public.token_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null, -- positive for credit, negative for application spends
  description text,
  created_at timestamptz not null default now()
);

create index if not exists token_transactions_user_id_idx
  on public.token_transactions (user_id);

-- Security definer so the admin check does not recurse through profiles RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.onboarding_applications enable row level security;
alter table public.profiles enable row level security;
alter table public.token_transactions enable row level security;

grant insert on table public.onboarding_applications to anon, authenticated;
grant select, update on table public.onboarding_applications to authenticated;
grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.token_transactions to authenticated;

drop policy if exists "Public can submit onboarding applications" on public.onboarding_applications;
create policy "Public can submit onboarding applications"
  on public.onboarding_applications
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Admins can read onboarding applications" on public.onboarding_applications;
create policy "Admins can read onboarding applications"
  on public.onboarding_applications
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Admins can read profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can read token transactions" on public.token_transactions;
create policy "Admins can read token transactions"
  on public.token_transactions
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert token transactions" on public.token_transactions;
create policy "Admins can insert token transactions"
  on public.token_transactions
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update token transactions" on public.token_transactions;
create policy "Admins can update token transactions"
  on public.token_transactions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
