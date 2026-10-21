-- Let PostgREST embed public.jobs on public.applications.
-- Only add the FK when jobs.id and applications.job_id share a type.

do $$
declare
  job_id_type text;
  apps_job_id_type text;
begin
  select data_type into job_id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'jobs' and column_name = 'id';

  select data_type into apps_job_id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'applications' and column_name = 'job_id';

  if job_id_type is null or apps_job_id_type is null then
    return;
  end if;

  if job_id_type <> apps_job_id_type then
    return;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'applications_job_id_fkey'
  ) then
    return;
  end if;

  begin
    alter table public.applications
      add constraint applications_job_id_fkey
      foreign key (job_id) references public.jobs (id)
      on delete cascade
      not valid;
  exception
    when others then
      null;
  end;
end $$;

notify pgrst, 'reload schema';
