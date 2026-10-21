alter table public.payout_requests
  add column if not exists payment_method text;

alter table public.payout_requests
  add column if not exists payout_details text;

alter table public.payout_requests
  add column if not exists amount numeric;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'payout_requests' and column_name = 'method'
  ) then
    execute 'update public.payout_requests set payment_method = coalesce(payment_method, method) where payment_method is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'payout_requests' and column_name = 'destination'
  ) then
    execute 'update public.payout_requests set payout_details = coalesce(payout_details, destination) where payout_details is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'payout_requests' and column_name = 'amount_usd'
  ) then
    execute 'update public.payout_requests set amount = coalesce(amount, amount_usd) where amount is null';
  end if;
end $$;
