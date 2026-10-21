-- Dedicated administrator records. Console access checks this table.

create table if not exists public.admin_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users add column if not exists email text;
alter table public.admin_users add column if not exists updated_at timestamptz not null default now();

alter table public.admin_users enable row level security;

grant select on table public.admin_users to authenticated;

drop policy if exists "Admins can read their own admin record" on public.admin_users;
create policy "Admins can read their own admin record"
  on public.admin_users
  for select
  to authenticated
  using (id = auth.uid());

-- Allow the signed-in user to read their own row even when JWT role claims lag.
drop policy if exists "Authenticated users can read matching admin row" on public.admin_users;
create policy "Authenticated users can read matching admin row"
  on public.admin_users
  for select
  to authenticated
  using (auth.uid() = id);

insert into public.admin_users (id, email)
select id, email
from public.profiles
where role = 'admin'
on conflict (id) do update
set email = coalesce(public.admin_users.email, excluded.email);
