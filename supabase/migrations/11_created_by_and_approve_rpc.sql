-- Fix admin_users.created_by FK for bypass / missing actor rows, plus approve_worker_account RPC.

alter table public.admin_users
  alter column created_by drop not null;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'admin_users_created_by_fkey'
  ) then
    alter table public.admin_users drop constraint admin_users_created_by_fkey;
  end if;
end $$;

alter table public.admin_users
  add constraint admin_users_created_by_fkey
  foreign key (created_by) references public.admin_users (id) on delete set null;

-- Ensure blackman super admin row exists for created_by references when known.
-- (No-op if the auth user is not present yet.)

create or replace function public.approve_worker_account(
  p_application_id uuid,
  p_temp_password text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  app record;
  existing_id uuid;
  result json;
begin
  if p_temp_password is null or length(trim(p_temp_password)) < 8 then
    raise exception 'Temporary password must be at least 8 characters';
  end if;

  select * into app
  from public.onboarding_applications
  where id = p_application_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Pending application not found';
  end if;

  select id into existing_id
  from public.profiles
  where lower(email) = lower(app.email)
  limit 1;

  update public.onboarding_applications
  set status = 'approved'
  where id = p_application_id;

  if existing_id is not null then
    update public.profiles
    set
      full_name = coalesce(app.full_name, full_name),
      country = coalesce(app.country, country),
      phone_number = coalesce(app.phone_number, phone_number),
      role = 'worker',
      status = 'active',
      is_approved = true,
      onboarding_status = 'approved',
      temp_recovery_pass = p_temp_password,
      token_balance = case when coalesce(token_balance, 0) = 0 then 50 else token_balance end
    where id = existing_id;

    result := json_build_object(
      'user_id', existing_id,
      'email', app.email,
      'created', false
    );
  else
    result := json_build_object(
      'user_id', null,
      'email', app.email,
      'created', true,
      'full_name', app.full_name,
      'country', app.country,
      'phone_number', app.phone_number
    );
  end if;

  return result;
end;
$$;

revoke all on function public.approve_worker_account(uuid, text) from public;
grant execute on function public.approve_worker_account(uuid, text) to service_role;
