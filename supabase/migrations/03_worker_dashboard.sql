-- Let a signed-in worker read their own profile, and store job applications.

drop policy if exists "Workers can read their own profile" on public.profiles;
create policy "Workers can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_title text not null,
  company text,
  token_cost integer not null default 0,
  status text not null default 'applied' check (status in ('applied', 'in review', 'accepted')),
  applied_at timestamptz not null default now()
);

create index if not exists job_applications_user_id_idx
  on public.job_applications (user_id);

alter table public.job_applications enable row level security;

grant select on table public.job_applications to authenticated;

drop policy if exists "Workers can read their own applications" on public.job_applications;
create policy "Workers can read their own applications"
  on public.job_applications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins can read job applications" on public.job_applications;
create policy "Admins can read job applications"
  on public.job_applications
  for select
  to authenticated
  using (public.is_admin());
