-- Dedicated table for 3rd-tier Worker Admins.

create table if not exists public.worker_admins (
  worker_id uuid primary key references public.profiles (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  created_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worker_admins_email_idx on public.worker_admins (lower(email));

alter table public.worker_admins enable row level security;

grant select on table public.worker_admins to authenticated;

drop policy if exists "Workers can read own worker_admin row" on public.worker_admins;
create policy "Workers can read own worker_admin row"
  on public.worker_admins for select to authenticated
  using (worker_id = auth.uid());

-- Backfill from profiles already marked as worker_admin
insert into public.worker_admins (worker_id, email, full_name)
select p.id, coalesce(p.email, ''), coalesce(p.full_name, '')
from public.profiles p
where p.role = 'worker_admin'
on conflict (worker_id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  updated_at = now();

-- Also backfill from admin_users with worker_admin role
insert into public.worker_admins (worker_id, email, full_name)
select a.id, coalesce(a.email, p.email, ''), coalesce(p.full_name, '')
from public.admin_users a
left join public.profiles p on p.id = a.id
where a.role = 'worker_admin'
on conflict (worker_id) do update
set
  email = excluded.email,
  full_name = coalesce(nullif(excluded.full_name, ''), public.worker_admins.full_name),
  updated_at = now();
