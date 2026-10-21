-- Job marketplace: tags, brief/full copy, min tokens, applicant details,
-- submit_job_application, get_job_leaderboard, review_job_application.

alter table public.jobs add column if not exists tags text[] not null default '{}';
alter table public.jobs add column if not exists brief_description text not null default '';
alter table public.jobs add column if not exists full_description text not null default '';
alter table public.jobs add column if not exists min_tokens integer not null default 5;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'description'
  ) then
    update public.jobs
    set brief_description = description
    where coalesce(brief_description, '') = '' and coalesce(description, '') <> '';
    update public.jobs
    set full_description = description
    where coalesce(full_description, '') = '' and coalesce(description, '') <> '';
  end if;
end $$;

do $$
begin
  begin
    alter table public.jobs alter column id set default gen_random_uuid()::text;
  exception
    when others then null;
  end;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'applications'
      and column_name = 'job_id'
      and data_type = 'uuid'
  ) then
    alter table public.applications alter column job_id type text using job_id::text;
  end if;
end $$;

alter table public.applications add column if not exists applicant_name text;
alter table public.applications add column if not exists applicant_email text;
alter table public.applications add column if not exists applicant_country text;
alter table public.applications add column if not exists email text;
alter table public.applications add column if not exists country text;
alter table public.applications add column if not exists cover_letter text;
alter table public.applications add column if not exists cv_url text;
alter table public.applications add column if not exists portfolio_url text;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'applications_tokens_staked_check'
  ) then
    alter table public.applications drop constraint applications_tokens_staked_check;
  end if;
  alter table public.applications
    add constraint applications_tokens_staked_check check (tokens_staked >= 1);
exception
  when duplicate_object then null;
end $$;

create or replace function public.anonymize_applicant_name(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  parts := regexp_split_to_array(btrim(coalesce(p_name, '')), E'\\s+');
  if array_length(parts, 1) is null or parts[1] = '' then
    return 'Applicant *****';
  end if;
  if array_length(parts, 1) >= 2 and length(parts[2]) > 0 then
    return parts[1] || ' ' || upper(left(parts[2], 1)) || '.*****';
  end if;
  return parts[1] || ' *****';
end;
$$;

create or replace function public.submit_job_application(
  p_job_id text,
  p_name text,
  p_email text,
  p_country text,
  p_cover_letter text,
  p_cv_url text default null,
  p_portfolio_url text default null,
  p_tokens_staked integer default 5
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_job_id text := btrim(coalesce(p_job_id, ''));
  v_min integer := 5;
  v_open boolean := true;
  v_balance numeric := 0;
  v_status text;
  v_id uuid;
begin
  if uid is null then
    raise exception 'You need to sign in.';
  end if;
  if v_job_id = '' then
    raise exception 'A job is required.';
  end if;
  if btrim(coalesce(p_cover_letter, '')) = '' then
    raise exception 'A cover letter is required.';
  end if;
  if p_tokens_staked is null or p_tokens_staked < 1 then
    raise exception 'Token bid must be at least 1.';
  end if;

  perform 1 from public.profiles where id = uid for update;

  select
    coalesce((to_jsonb(j)->>'min_tokens')::integer, 5),
    coalesce((to_jsonb(j)->>'is_active')::boolean, true)
      and coalesce(to_jsonb(j)->>'hiring_status', 'hiring') = 'hiring'
    into v_min, v_open
  from public.jobs j
  where j.id::text = v_job_id
  limit 1;

  if not found then
    raise exception 'Job not found.';
  end if;
  if v_open is false then
    raise exception 'This job is not open.';
  end if;
  if p_tokens_staked < v_min then
    raise exception 'Minimum tokens required is %.', v_min;
  end if;

  if exists (
    select 1 from public.applications
    where applications.job_id = v_job_id and worker_id = uid
  ) then
    raise exception 'You already applied to this job.';
  end if;

  select coalesce(token_balance, 0), status
    into v_balance, v_status
  from public.profiles
  where id = uid;

  if not found then
    raise exception 'Profile not found.';
  end if;
  if v_status in ('banned', 'temp_disabled') then
    raise exception 'Your account cannot apply right now.';
  end if;
  if v_balance < p_tokens_staked then
    raise exception 'Insufficient tokens. Minimum required is %.', v_min;
  end if;

  insert into public.applications (
    job_id, worker_id, tokens_staked, status,
    applicant_name, applicant_email, applicant_country, email, country,
    cover_letter, cv_url, portfolio_url
  )
  values (
    v_job_id, uid, p_tokens_staked, 'submitted',
    nullif(btrim(coalesce(p_name, '')), ''),
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_country, '')), ''),
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_country, '')), ''),
    btrim(p_cover_letter),
    nullif(btrim(coalesce(p_cv_url, '')), ''),
    nullif(btrim(coalesce(p_portfolio_url, '')), '')
  )
  returning id into v_id;

  update public.profiles
  set token_balance = coalesce(token_balance, 0) - p_tokens_staked,
      total_tokens_spent = coalesce(total_tokens_spent, 0) + p_tokens_staked
  where id = uid;

  return json_build_object(
    'id', v_id,
    'tokens_staked', p_tokens_staked,
    'token_balance', v_balance - p_tokens_staked
  );
end;
$$;

revoke all on function public.submit_job_application(text, text, text, text, text, text, text, integer) from public;
grant execute on function public.submit_job_application(text, text, text, text, text, text, text, integer) to authenticated;

create or replace function public.get_job_leaderboard(p_job_id text)
returns table (
  rank integer,
  anonymized_name text,
  tokens_staked numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_job_id text := btrim(coalesce(p_job_id, ''));
  v_slots integer := 5;
begin
  if v_job_id = '' then
    raise exception 'A job is required.';
  end if;

  if uid is not null
     and not exists (select 1 from public.admin_users where id = uid and role in ('admin', 'super_admin'))
     and not exists (select 1 from public.applications a where a.job_id = v_job_id and a.worker_id = uid)
  then
    raise exception 'Not authorized.';
  end if;

  select greatest(1, coalesce(slots_needed, 5))
    into v_slots
  from public.jobs
  where id::text = v_job_id
  limit 1;

  if v_slots is null then
    v_slots := 5;
  end if;

  return query
  select
    ranked.rank::integer,
    public.anonymize_applicant_name(ranked.display_name) as anonymized_name,
    ranked.tokens_staked
  from (
    select
      row_number() over (order by a.tokens_staked desc, a.created_at asc) as rank,
      coalesce(nullif(btrim(a.applicant_name), ''), p.full_name, 'Applicant') as display_name,
      a.tokens_staked
    from public.applications a
    left join public.profiles p on p.id = a.worker_id
    where a.job_id::text = v_job_id
      and a.status <> 'rejected'
    order by a.tokens_staked desc, a.created_at asc
    limit v_slots
  ) ranked;
end;
$$;

revoke all on function public.get_job_leaderboard(text) from public;
grant execute on function public.get_job_leaderboard(text) to authenticated, service_role;

create or replace function public.review_job_application(p_app_id uuid, p_new_status text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.applications%rowtype;
  refunded numeric := 0;
begin
  if p_new_status not in ('hired', 'rejected') then
    raise exception 'Status must be hired or rejected.';
  end if;

  if uid is not null
     and not exists (select 1 from public.admin_users where id = uid and role in ('admin', 'super_admin'))
  then
    raise exception 'Not authorized.';
  end if;

  select * into r
  from public.applications
  where id = p_app_id
  for update;

  if not found then
    raise exception 'Application not found.';
  end if;

  if r.status in ('hired', 'rejected') then
    raise exception 'This application has already been reviewed.';
  end if;

  if p_new_status = 'rejected' then
    perform 1 from public.profiles where id = r.worker_id for update;
    update public.profiles
    set token_balance = coalesce(token_balance, 0) + r.tokens_staked
    where id = r.worker_id;
    refunded := r.tokens_staked;
  end if;

  update public.applications
  set status = p_new_status, updated_at = now()
  where id = p_app_id;

  return json_build_object(
    'id', p_app_id,
    'status', p_new_status,
    'refunded', refunded
  );
end;
$$;

revoke all on function public.review_job_application(uuid, text) from public;
grant execute on function public.review_job_application(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
