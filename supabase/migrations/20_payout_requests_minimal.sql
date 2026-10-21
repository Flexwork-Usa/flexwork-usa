-- Minimal public.payout_requests schema:
-- id, worker_id, method, address, amount, status, created_at

alter table public.payout_requests add column if not exists address text;
alter table public.payout_requests add column if not exists method text;
alter table public.payout_requests add column if not exists amount numeric;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payout_requests' and column_name = 'payout_details'
  ) then
    execute $sql$
      update public.payout_requests
      set address = coalesce(nullif(btrim(address), ''), payout_details)
      where address is null or btrim(address) = ''
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payout_requests' and column_name = 'destination'
  ) then
    execute $sql$
      update public.payout_requests
      set address = coalesce(nullif(btrim(address), ''), destination)
      where address is null or btrim(address) = ''
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payout_requests' and column_name = 'payment_method'
  ) then
    execute $sql$
      update public.payout_requests
      set method = coalesce(method, payment_method)
      where method is null
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payout_requests' and column_name = 'amount_usd'
  ) then
    execute $sql$
      update public.payout_requests
      set amount = coalesce(amount, amount_usd)
      where amount is null
    $sql$;
  end if;
end $$;

update public.payout_requests set status = 'approved' where status = 'paid';
update public.payout_requests set address = '' where address is null;
update public.payout_requests set method = 'crypto' where method is null or method not in ('crypto', 'airtm', 'paypal');
update public.payout_requests set amount = 50 where amount is null;

do $$
declare
  col text;
begin
  foreach col in array array['destination', 'amount_usd', 'payout_details', 'payment_method', 'network', 'admin_note']
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'payout_requests'
        and column_name = col
        and is_nullable = 'NO'
    ) then
      execute format('alter table public.payout_requests alter column %I drop not null', col);
    end if;
  end loop;
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'payout_requests_status_check') then
    alter table public.payout_requests drop constraint payout_requests_status_check;
  end if;
  if exists (select 1 from pg_constraint where conname = 'payout_requests_method_check') then
    alter table public.payout_requests drop constraint payout_requests_method_check;
  end if;
  if exists (select 1 from pg_constraint where conname = 'payout_requests_amount_check') then
    alter table public.payout_requests drop constraint payout_requests_amount_check;
  end if;
end $$;

alter table public.payout_requests
  alter column address set not null,
  alter column method set not null,
  alter column amount set not null;

alter table public.payout_requests
  add constraint payout_requests_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table public.payout_requests
  add constraint payout_requests_method_check
  check (method in ('crypto', 'airtm', 'paypal'));

alter table public.payout_requests
  add constraint payout_requests_amount_check
  check (amount >= 50);

create or replace function public.review_payout_request(p_id uuid, p_status text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'Status must be approved or rejected';
  end if;

  select status into current_status
  from public.payout_requests
  where id = p_id
  for update;

  if current_status is null then
    raise exception 'Payout request not found';
  end if;

  if current_status <> 'pending' then
    raise exception 'Payout request is not pending';
  end if;

  update public.payout_requests
  set status = p_status
  where id = p_id;

  return json_build_object('id', p_id, 'status', p_status);
end;
$$;

revoke all on function public.review_payout_request(uuid, text) from public;
grant execute on function public.review_payout_request(uuid, text) to service_role;
