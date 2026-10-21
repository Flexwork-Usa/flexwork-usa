-- Strict treasury_deposits state machine:
--   waiting  → expired (timer lapsed before TXID)
--   waiting  → pending (TXID submitted)
--   pending  → finished | rejected  (admin only; never expired)
-- Plus network column, expire RPC, and atomic approve+credit RPC.

alter table public.treasury_deposits
  add column if not exists network text;

update public.treasury_deposits
set network = case
  when deposit_address ilike 'T%' then 'TRC20'
  when deposit_address ilike '0x%' then 'BEP20'
  else coalesce(network, 'TRC20')
end
where network is null;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'treasury_deposits_network_check'
  ) then
    alter table public.treasury_deposits drop constraint treasury_deposits_network_check;
  end if;
end $$;

alter table public.treasury_deposits
  add constraint treasury_deposits_network_check
  check (network is null or network in ('TRC20', 'ERC20', 'BEP20'));

-- Migrate legacy statuses into the new machine.
update public.treasury_deposits
set status = 'finished', updated_at = now()
where status = 'approved';

update public.treasury_deposits
set status = 'waiting', updated_at = now()
where status = 'pending'
  and (tx_hash is null or length(trim(tx_hash)) = 0)
  and expires_at > now();

update public.treasury_deposits
set status = 'expired', updated_at = now()
where status = 'pending'
  and (tx_hash is null or length(trim(tx_hash)) = 0)
  and expires_at <= now();

-- Remaining pending rows keep status pending (have TXID, awaiting admin).

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'treasury_deposits_status_check'
  ) then
    alter table public.treasury_deposits drop constraint treasury_deposits_status_check;
  end if;
end $$;

alter table public.treasury_deposits
  alter column status set default 'waiting';

alter table public.treasury_deposits
  add constraint treasury_deposits_status_check
  check (status in ('waiting', 'pending', 'finished', 'rejected', 'expired'));

-- Workers may only mutate waiting sessions (submit TXID → pending handled via service role / RPC).
drop policy if exists "Workers can update own pending treasury deposits" on public.treasury_deposits;
drop policy if exists "Workers can update own waiting treasury deposits" on public.treasury_deposits;
create policy "Workers can update own waiting treasury deposits"
  on public.treasury_deposits for update to authenticated
  using (worker_id = auth.uid() and status = 'waiting')
  with check (worker_id = auth.uid() and status in ('waiting', 'pending'));

create or replace function public.generate_deposit_memo()
returns text
language plpgsql
as $$
declare
  code text;
begin
  loop
    code := 'FW-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (
      select 1
      from public.treasury_deposits
      where memo_code = code
        and status in ('waiting', 'pending')
    );
  end loop;
  return code;
end;
$$;

-- Only waiting sessions expire. Pending (TXID submitted) is frozen for admin review.
create or replace function public.expire_treasury_deposits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.treasury_deposits
  set status = 'expired', updated_at = now()
  where status = 'waiting'
    and expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.expire_treasury_deposits() from public;
grant execute on function public.expire_treasury_deposits() to authenticated, service_role;

-- Atomic approve: pending → finished + credit token_balance
create or replace function public.approve_treasury_deposit(p_deposit_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.treasury_deposits%rowtype;
  new_balance numeric;
begin
  if p_deposit_id is null then
    raise exception 'Deposit id is required';
  end if;

  select * into d
  from public.treasury_deposits
  where id = p_deposit_id
  for update;

  if not found then
    raise exception 'Deposit not found';
  end if;

  if d.status <> 'pending' then
    raise exception 'Deposit is not pending admin review';
  end if;

  if d.tx_hash is null or length(trim(d.tx_hash)) = 0 then
    raise exception 'Deposit is missing a transaction hash';
  end if;

  update public.treasury_deposits
  set status = 'finished', updated_at = now()
  where id = p_deposit_id;

  update public.profiles
  set token_balance = coalesce(token_balance, 0) + d.tokens_issued
  where id = d.worker_id
  returning token_balance into new_balance;

  if not found then
    raise exception 'Worker profile was not found';
  end if;

  begin
    insert into public.token_transactions (user_id, amount, description)
    values (
      d.worker_id,
      d.tokens_issued,
      format(
        'Treasury deposit finished ($%s USDT · Tx: %s)',
        trim(to_char(d.usdt_amount, '999999990.99')),
        d.tx_hash
      )
    );
  exception
    when undefined_table then
      null;
    when others then
      null;
  end;

  return json_build_object(
    'deposit_id', d.id,
    'worker_id', d.worker_id,
    'tokens_credited', d.tokens_issued,
    'token_balance', new_balance,
    'status', 'finished'
  );
end;
$$;

revoke all on function public.approve_treasury_deposit(uuid) from public;
grant execute on function public.approve_treasury_deposit(uuid) to service_role;

create or replace function public.reject_treasury_deposit(p_deposit_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.treasury_deposits%rowtype;
begin
  select * into d
  from public.treasury_deposits
  where id = p_deposit_id
  for update;

  if not found then
    raise exception 'Deposit not found';
  end if;

  if d.status <> 'pending' then
    raise exception 'Deposit is not pending admin review';
  end if;

  update public.treasury_deposits
  set status = 'rejected', updated_at = now()
  where id = p_deposit_id;

  return json_build_object('deposit_id', d.id, 'status', 'rejected');
end;
$$;

revoke all on function public.reject_treasury_deposit(uuid) from public;
grant execute on function public.reject_treasury_deposit(uuid) to service_role;
