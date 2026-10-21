-- Onboarding status, recovery passwords, worker dashboard stats RPC.

alter table public.profiles add column if not exists onboarding_status text not null default 'pending_approval';
alter table public.profiles add column if not exists temp_recovery_pass text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_onboarding_status_check') then
    alter table public.profiles
      add constraint profiles_onboarding_status_check
      check (onboarding_status in ('pending_approval', 'approved', 'rejected'));
  end if;
end $$;

-- Align existing approved workers
update public.profiles
set onboarding_status = 'approved'
where is_approved = true and onboarding_status = 'pending_approval';

-- Worker dashboard analytics
create or replace function public.get_worker_dashboard_stats(p_worker_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  select json_build_object(
    'pipeline', coalesce((
      select json_agg(row_to_json(t))
      from (
        select s.status, coalesce(c.cnt, 0)::integer as count
        from (
          values
            ('submitted'),
            ('viewed'),
            ('under_review'),
            ('hired'),
            ('rejected')
        ) as s(status)
        left join (
          select status, count(*)::integer as cnt
          from public.applications
          where worker_id = p_worker_id
          group by status
        ) c on c.status = s.status
      ) t
    ), '[]'::json),
    'earnings', coalesce((
      select json_agg(row_to_json(e) order by e.day)
      from (
        select
          date_trunc('day', created_at)::date as day,
          coalesce(sum(case when status in ('approved', 'paid') then amount_usd else 0 end), 0)::numeric as amount
        from public.payout_requests
        where worker_id = p_worker_id
          and created_at >= now() - interval '30 days'
        group by 1
        order by 1
      ) e
    ), '[]'::json),
    'total_earnings', coalesce((
      select total_earnings from public.profiles where id = p_worker_id
    ), 0)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_worker_dashboard_stats(uuid) from public;
grant execute on function public.get_worker_dashboard_stats(uuid) to authenticated, service_role;
