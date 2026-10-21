-- Prefer profiles.role = 'worker_admin' over a separate boolean flag.
alter table public.profiles drop column if exists is_worker_admin;
