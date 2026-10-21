-- Allow security-definer payout RPCs to change pending_earnings, and
-- deduct available balance when a worker submits a withdrawal.

create or replace function public.protect_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('flexwork.skip_profile_guard', true) = 'on' then
    return new;
  end if;
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if exists (
    select 1 from public.admin_users
    where id = auth.uid() and role in ('admin', 'super_admin')
  ) then
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

create or replace function public.submit_payout_request(
  p_method text,
  p_address text,
  p_amount numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_status text;
  v_pending numeric := 0;
  v_id uuid;
  v_address text := btrim(coalesce(p_address, ''));
begin
  perform set_config('flexwork.skip_profile_guard', 'on', true);

  if uid is null then
    raise exception 'You need to sign in.';
  end if;

  if p_method not in ('crypto', 'airtm', 'paypal') then
    raise exception 'Choose Crypto, Airtm, or PayPal.';
  end if;

  if v_address = '' then
    raise exception 'A payout address is required.';
  end if;

  if p_amount is null or p_amount < 50 then
    raise exception 'Minimum payout threshold is $50.00.';
  end if;

  select status, coalesce(pending_earnings, 0)
  into v_status, v_pending
  from public.profiles
  where id = uid
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  if v_status is distinct from 'active' then
    raise exception 'Your account is restricted. Contact support.';
  end if;

  if exists (select 1 from public.worker_admins where worker_id = uid) then
    select coalesce(pending_earnings, v_pending)
    into v_pending
    from public.worker_admins
    where worker_id = uid
    for update;
  end if;

  if v_pending < 50 then
    raise exception 'Minimum payout threshold is $50.00.';
  end if;

  if v_pending < p_amount then
    raise exception 'Requested amount exceeds available earnings.';
  end if;

  update public.profiles
  set pending_earnings = coalesce(pending_earnings, 0) - p_amount
  where id = uid;

  update public.worker_admins
  set pending_earnings = coalesce(pending_earnings, 0) - p_amount,
      updated_at = now()
  where worker_id = uid;

  insert into public.payout_requests (worker_id, method, address, amount, status)
  values (uid, p_method, v_address, p_amount, 'pending')
  returning id into v_id;

  return json_build_object(
    'id', v_id,
    'amount', p_amount,
    'status', 'pending',
    'pending_earnings', v_pending - p_amount
  );
end;
$$;

revoke all on function public.submit_payout_request(text, text, numeric) from public;
grant execute on function public.submit_payout_request(text, text, numeric) to authenticated;

create or replace function public.review_payout_request(p_payout_id uuid, p_new_status text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.payout_requests%rowtype;
begin
  perform set_config('flexwork.skip_profile_guard', 'on', true);

  if p_new_status not in ('approved', 'rejected') then
    raise exception 'Status must be approved or rejected';
  end if;

  select * into r
  from public.payout_requests
  where id = p_payout_id
  for update;

  if not found then
    raise exception 'Payout request not found';
  end if;

  if r.status <> 'pending' then
    raise exception 'Payout request is not pending';
  end if;

  perform 1 from public.profiles where id = r.worker_id for update;

  if exists (select 1 from public.worker_admins where worker_id = r.worker_id) then
    perform 1 from public.worker_admins where worker_id = r.worker_id for update;
  end if;

  if p_new_status = 'approved' then
    update public.payout_requests set status = 'approved' where id = p_payout_id;
    update public.profiles
    set total_earnings = coalesce(total_earnings, 0) + r.amount
    where id = r.worker_id;
    update public.worker_admins
    set total_earnings = coalesce(total_earnings, 0) + r.amount,
        updated_at = now()
    where worker_id = r.worker_id;
  else
    update public.payout_requests set status = 'rejected' where id = p_payout_id;
    update public.profiles
    set pending_earnings = coalesce(pending_earnings, 0) + r.amount
    where id = r.worker_id;
    update public.worker_admins
    set pending_earnings = coalesce(pending_earnings, 0) + r.amount,
        updated_at = now()
    where worker_id = r.worker_id;
  end if;

  return json_build_object('id', p_payout_id, 'status', p_new_status, 'amount', r.amount);
end;
$$;

revoke all on function public.review_payout_request(uuid, text) from public;
grant execute on function public.review_payout_request(uuid, text) to service_role;
