alter table public.payout_requests
  add column if not exists amount numeric;

update public.payout_requests
set amount = amount_usd
where amount is null;

alter table public.payout_requests
  alter column amount set not null;
