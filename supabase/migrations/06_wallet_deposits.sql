-- Worker deposit notifications. Tokens stay uncredited until an admin approves the row.

create table if not exists public.wallet_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  plan_title text not null,
  amount_usd numeric not null,
  tokens_to_credit integer not null,
  wallet_type text not null,
  transaction_hash text not null,
  status text not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wallet_deposits enable row level security;

grant select, insert on table public.wallet_deposits to authenticated;

drop policy if exists "Workers can read their own deposits" on public.wallet_deposits;
create policy "Workers can read their own deposits"
  on public.wallet_deposits
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Workers can submit their own deposits" on public.wallet_deposits;
create policy "Workers can submit their own deposits"
  on public.wallet_deposits
  for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "Admins can read deposits" on public.wallet_deposits;
create policy "Admins can read deposits"
  on public.wallet_deposits
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update deposits" on public.wallet_deposits;
create policy "Admins can update deposits"
  on public.wallet_deposits
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
