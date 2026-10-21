-- Allow admin pipeline steps: viewed, under_review, hired, rejected.
-- Hire/reject still refund only on reject. View/review only move the status.

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
  next_status text := lower(coalesce(p_new_status, ''));
begin
  if next_status in ('hire') then
    next_status := 'hired';
  elsif next_status in ('view') then
    next_status := 'viewed';
  elsif next_status in ('review') then
    next_status := 'under_review';
  end if;

  if next_status not in ('viewed', 'under_review', 'hired', 'rejected') then
    raise exception 'Status must be viewed, under_review, hired, or rejected.';
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

  if next_status = 'rejected' then
    perform 1 from public.profiles where id = r.worker_id for update;
    update public.profiles
    set token_balance = coalesce(token_balance, 0) + r.tokens_staked
    where id = r.worker_id;
    refunded := r.tokens_staked;
  end if;

  begin
    update public.applications
    set status = next_status, updated_at = now()
    where id = p_app_id;
  exception
    when undefined_column then
      update public.applications
      set status = next_status
      where id = p_app_id;
  end;

  return json_build_object(
    'id', p_app_id,
    'status', next_status,
    'refunded', refunded
  );
end;
$$;

revoke all on function public.review_job_application(uuid, text) from public;
grant execute on function public.review_job_application(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
