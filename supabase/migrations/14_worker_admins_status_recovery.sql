-- Align worker_admins with management UI fields (status + recovery password).

alter table public.worker_admins
  add column if not exists status text not null default 'active';

alter table public.worker_admins
  add column if not exists temp_recovery_pass text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'worker_admins_status_check'
  ) then
    alter table public.worker_admins
      add constraint worker_admins_status_check
      check (status in ('active', 'under_review', 'temp_disabled', 'banned'));
  end if;
end $$;

-- Sync status + recovery password from profiles where available
update public.worker_admins wa
set
  status = coalesce(nullif(p.status, ''), wa.status, 'active'),
  temp_recovery_pass = coalesce(wa.temp_recovery_pass, p.temp_recovery_pass),
  email = coalesce(nullif(wa.email, ''), p.email, wa.email),
  full_name = coalesce(nullif(wa.full_name, ''), p.full_name, wa.full_name),
  updated_at = now()
from public.profiles p
where p.id = wa.worker_id;
