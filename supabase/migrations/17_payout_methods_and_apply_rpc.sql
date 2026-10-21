-- Payout destinations on worker profiles + defensive apply / password RPCs.

alter table public.profiles
  add column if not exists payout_usdt_address text;

alter table public.profiles
  add column if not exists payout_airtm_email text;

alter table public.profiles
  add column if not exists payout_paypal_email text;

alter table public.profiles
  add column if not exists payout_method text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_payout_method_check'
  ) then
    alter table public.profiles
      add constraint profiles_payout_method_check
      check (payout_method is null or payout_method in ('crypto', 'airtm', 'paypal'));
  end if;
end $$;

alter table public.treasury_deposits
  add column if not exists plan_title text;

-- Ensure an authenticated worker always has a profiles row.
create or replace function public.ensure_worker_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rec public.profiles%rowtype;
  auth_email text;
  auth_name text;
begin
  if uid is null then
    raise exception 'You need to sign in.';
  end if;

  select * into rec from public.profiles where id = uid;
  if found then
    return rec;
  end if;

  select email, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
  into auth_email, auth_name
  from auth.users
  where id = uid;

  insert into public.profiles (id, email, full_name, role, status, is_approved, onboarding_status, token_balance)
  values (
    uid,
    coalesce(auth_email, ''),
    coalesce(auth_name, 'Worker'),
    'worker',
    'active',
    true,
    'approved',
    50
  )
  on conflict (id) do update
    set email = excluded.email
  returning * into rec;

  return rec;
end;
$$;

revoke all on function public.ensure_worker_profile() from public;
grant execute on function public.ensure_worker_profile() to authenticated;

create or replace function public.apply_to_curated_job(p_job_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  job_found boolean := false;
  job_open boolean := true;
  balance integer;
  rec public.profiles%rowtype;
begin
  if uid is null then
    raise exception 'You need to sign in.';
  end if;

  if p_job_id is null or length(trim(p_job_id)) = 0 then
    raise exception 'A job is required.';
  end if;

  perform set_config('row_security', 'off', true);

  rec := public.ensure_worker_profile();

  begin
    select true,
           coalesce(is_active, true)
      into job_found, job_open
    from public.jobs
    where id::text = trim(p_job_id)
    limit 1;
  exception
    when undefined_column then
      select true into job_found from public.jobs where id::text = trim(p_job_id) limit 1;
      job_open := true;
    when others then
      job_found := false;
  end;

  if job_found and job_open is false then
    raise exception 'This job is not open.';
  end if;

  if exists (
    select 1 from public.job_applications
    where user_id = uid and job_id::text = trim(p_job_id)
  ) then
    raise exception 'You already applied to this job.';
  end if;

  insert into public.job_applications (user_id, job_id, status, tokens_spent)
  values (uid, trim(p_job_id), 'applied', 0);

  select coalesce(token_balance, 0) into balance from public.profiles where id = uid;
  return coalesce(balance, rec.token_balance, 0);
end;
$$;

-- UUID overload so PostgREST matches either signature without schema-cache misses.
create or replace function public.apply_to_curated_job(p_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.apply_to_curated_job(p_job_id::text);
end;
$$;

revoke all on function public.apply_to_curated_job(text) from public;
revoke all on function public.apply_to_curated_job(uuid) from public;
grant execute on function public.apply_to_curated_job(text) to authenticated;
grant execute on function public.apply_to_curated_job(uuid) to authenticated;

create or replace function public.can_change_password(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  changed_at timestamptz;
begin
  if p_user_id is null then
    return false;
  end if;

  select last_password_change_at into changed_at
  from public.profiles
  where id = p_user_id;

  if not found then
    return true;
  end if;

  return changed_at is null or changed_at <= now() - interval '24 hours';
end;
$$;

revoke all on function public.can_change_password(uuid) from public;
grant execute on function public.can_change_password(uuid) to authenticated;

notify pgrst, 'reload schema';
