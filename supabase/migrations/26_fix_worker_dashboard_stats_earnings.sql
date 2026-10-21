-- Rebuild dashboard stats earnings from the live payout amount column.
-- Older RPCs summed amount_usd, which is often missing after payout schema cleanup.

create or replace function public.get_worker_dashboard_stats(p_worker_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
  v_pending numeric := 0;
  v_month numeric := 0;
  v_total numeric := 0;
begin
  select
    coalesce(pending_earnings, 0),
    coalesce(earned_this_month, 0),
    coalesce(total_earnings, 0)
  into v_pending, v_month, v_total
  from public.profiles
  where id = p_worker_id;

  if exists (select 1 from public.worker_admins where worker_id = p_worker_id) then
    select
      coalesce(pending_earnings, v_pending),
      coalesce(earned_this_month, v_month),
      coalesce(total_earnings, v_total)
    into v_pending, v_month, v_total
    from public.worker_admins
    where worker_id = p_worker_id;
  end if;

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
          created_at::date as day,
          coalesce(sum(
            coalesce(
              nullif(to_jsonb(payout_requests)->>'amount', '')::numeric,
              nullif(to_jsonb(payout_requests)->>'amount_usd', '')::numeric,
              0
            )
          ), 0)::numeric as amount
        from public.payout_requests
        where worker_id = p_worker_id
          and status in ('approved', 'paid')
          and created_at >= now() - interval '30 days'
        group by 1
        order by 1
      ) e
    ), '[]'::json),
    'pending_earnings', v_pending,
    'earned_this_month', v_month,
    'total_earnings', v_total
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_worker_dashboard_stats(uuid) from public;
grant execute on function public.get_worker_dashboard_stats(uuid) to authenticated, service_role;
