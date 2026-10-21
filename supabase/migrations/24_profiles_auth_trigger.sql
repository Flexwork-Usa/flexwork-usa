-- Step 1: lock public.profiles columns, auth.users → profile trigger, and RLS.

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists role text not null default 'worker';
alter table public.profiles add column if not exists token_balance integer not null default 0;
alter table public.profiles add column if not exists total_tokens_spent numeric not null default 0;
alter table public.profiles add column if not exists pending_earnings numeric not null default 0;
alter table public.profiles add column if not exists total_earnings numeric not null default 0;
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists created_at timestamptz not null default now();

update public.profiles set email = coalesce(nullif(btrim(email), ''), 'unknown@flexwork.local') where email is null;
alter table public.profiles alter column email set not null;
alter table public.profiles alter column role set default 'worker';
alter table public.profiles alter column token_balance set default 0;
alter table public.profiles alter column total_tokens_spent set default 0;
alter table public.profiles alter column pending_earnings set default 0;
alter table public.profiles alter column total_earnings set default 0;

do $$
begin
  alter table public.profiles alter column pending_earnings type numeric(10, 2);
  alter table public.profiles alter column total_earnings type numeric(10, 2);
exception
  when others then null;
end $$;
alter table public.profiles alter column status set default 'active';

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'profiles'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) ilike '%REFERENCES auth.users%'
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users (id) on delete cascade;
  end if;
end $$;

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'suspended', 'banned', 'under_review', 'temp_disabled'));

alter table public.profiles drop constraint if exists profiles_role_check;
do $$
begin
  if not exists (
    select 1 from public.profiles
    where coalesce(role, '') not in ('worker', 'worker_admin', 'admin', 'super_admin')
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('worker', 'worker_admin', 'admin', 'super_admin'));
  end if;
end $$;

create or replace function public.is_ops_admin()
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
      and role in ('admin', 'super_admin')
  ) or exists (
    select 1
    from public.admin_users
    where id = auth.uid()
      and role in ('admin', 'super_admin')
  )
  into allowed;
  return coalesce(allowed, false);
end;
$$;

revoke all on function public.is_ops_admin() from public;
grant execute on function public.is_ops_admin() to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    country,
    role,
    token_balance,
    total_tokens_spent,
    pending_earnings,
    total_earnings,
    status
  )
  values (
    new.id,
    coalesce(nullif(btrim(new.email), ''), 'unknown@flexwork.local'),
    nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data->>'country', '')), ''),
    'worker',
    0,
    0,
    0,
    0,
    'active'
  )
  on conflict (id) do update
    set email = case
      when coalesce(nullif(btrim(public.profiles.email), ''), '') in ('', 'unknown@flexwork.local')
        then excluded.email
      else public.profiles.email
    end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.protect_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Direct worker REST updates freeze balances. Security-definer RPCs and
  -- service-role writes (current_user is not `authenticated`) must keep working.
  if current_setting('flexwork.skip_profile_guard', true) = 'on' then
    return new;
  end if;
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if auth.uid() is null or public.is_ops_admin() then
    return new;
  end if;
  if auth.uid() is distinct from old.id then
    raise exception 'You can only update your own profile.';
  end if;
  new.id := old.id;
  new.email := old.email;
  new.role := old.role;
  new.status := old.status;
  new.token_balance := old.token_balance;
  new.total_tokens_spent := old.total_tokens_spent;
  new.pending_earnings := old.pending_earnings;
  new.total_earnings := old.total_earnings;
  return new;
end;
$$;

drop trigger if exists profiles_protect_sensitive_columns on public.profiles;
create trigger profiles_protect_sensitive_columns
  before update on public.profiles
  for each row execute procedure public.protect_profile_sensitive_columns();

create or replace function public.update_own_profile(p_full_name text, p_country text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rec public.profiles%rowtype;
begin
  if uid is null then
    raise exception 'You need to sign in.';
  end if;
  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'A name is required.';
  end if;
  if btrim(coalesce(p_country, '')) = '' then
    raise exception 'A country is required.';
  end if;

  update public.profiles
  set
    full_name = btrim(p_full_name),
    country = btrim(p_country)
  where id = uid
  returning * into rec;

  if not found then
    raise exception 'Profile not found.';
  end if;

  return json_build_object(
    'id', rec.id,
    'full_name', rec.full_name,
    'email', rec.email,
    'country', rec.country,
    'token_balance', rec.token_balance
  );
end;
$$;

revoke all on function public.update_own_profile(text, text) from public;
grant execute on function public.update_own_profile(text, text) to authenticated;

alter table public.profiles enable row level security;
grant select, update on table public.profiles to authenticated;

drop policy if exists "Workers can read their own profile" on public.profiles;
create policy "Workers can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_ops_admin());

drop policy if exists "Workers can update their own profile" on public.profiles;
create policy "Workers can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid() or public.is_ops_admin())
  with check (id = auth.uid() or public.is_ops_admin());

drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Admins can read profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_ops_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles
  for update
  to authenticated
  using (public.is_ops_admin())
  with check (public.is_ops_admin());
