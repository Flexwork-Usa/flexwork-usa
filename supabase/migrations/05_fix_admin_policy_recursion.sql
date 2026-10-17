-- Admin checks must not re-enter profiles policies.
-- Workers apply through these functions so the browser key never updates balances directly.

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  perform set_config('row_security', 'off', true);
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
  into allowed;
  return coalesce(allowed, false);
end;
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "Workers can read their own profile" on public.profiles;
create policy "Workers can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Anyone can read active jobs" on public.jobs;
create policy "Anyone can read active jobs"
  on public.jobs
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Public can submit onboarding applications" on public.onboarding_applications;
create policy "Public can submit onboarding applications"
  on public.onboarding_applications
  for insert
  to anon, authenticated
  with check (true);

create or replace function public.apply_to_affiliate_job(
  p_job_id text,
  p_token_cost integer default 10
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  job public.jobs%rowtype;
  balance integer;
  cost integer;
  new_balance integer;
begin
  if uid is null then
    raise exception 'You need to sign in.';
  end if;

  perform set_config('row_security', 'off', true);

  select * into job
  from public.jobs
  where id = p_job_id
    and is_active = true;

  if not found or job.tier::text <> '2' then
    raise exception 'This job is not open.';
  end if;

  if exists (
    select 1
    from public.job_applications
    where user_id = uid
      and job_id = p_job_id
  ) then
    raise exception 'You already applied to this job.';
  end if;

  cost := greatest(coalesce(job.token_cost, p_token_cost, 10), 10);

  select token_balance into balance
  from public.profiles
  where id = uid
  for update;

  if not found then
    raise exception 'Worker profile was not found.';
  end if;

  if coalesce(balance, 0) < 10 or coalesce(balance, 0) < cost then
    raise exception 'Insufficient tokens. Minimum required: 10 tokens ($2.00).';
  end if;

  new_balance := balance - cost;

  update public.profiles
  set token_balance = new_balance
  where id = uid;

  insert into public.token_transactions (user_id, amount, description)
  values (uid, -cost, 'Applied to Affiliate Job');

  insert into public.job_applications (user_id, job_id, status, tokens_spent)
  values (uid, p_job_id, 'applied', cost);

  return new_balance;
end;
$$;

create or replace function public.apply_to_curated_job(p_job_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  job public.jobs%rowtype;
  balance integer;
begin
  if uid is null then
    raise exception 'You need to sign in.';
  end if;

  perform set_config('row_security', 'off', true);

  select * into job
  from public.jobs
  where id = p_job_id
    and is_active = true;

  if not found or job.tier::text <> '1' then
    raise exception 'This job is not open.';
  end if;

  if exists (
    select 1
    from public.job_applications
    where user_id = uid
      and job_id = p_job_id
  ) then
    raise exception 'You already applied to this job.';
  end if;

  select coalesce(token_balance, 0) into balance
  from public.profiles
  where id = uid;

  if not found then
    raise exception 'Worker profile was not found.';
  end if;

  insert into public.job_applications (user_id, job_id, status, tokens_spent)
  values (uid, p_job_id, 'applied', 0);

  return balance;
end;
$$;

revoke all on function public.apply_to_affiliate_job(text, integer) from public;
revoke all on function public.apply_to_curated_job(text) from public;
grant execute on function public.apply_to_affiliate_job(text, integer) to authenticated;
grant execute on function public.apply_to_curated_job(text) to authenticated;
