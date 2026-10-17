-- Match the live jobs and job_applications columns, and seed the marketplace
-- only when those tables are empty.

create table if not exists public.jobs (
  id text primary key,
  title text not null,
  company text not null,
  tier smallint not null,
  description text not null default '',
  pay_rate text not null default '',
  token_cost integer not null default 0,
  external_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id text references public.jobs (id) on delete set null,
  status text not null default 'applied',
  tokens_spent integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.jobs (id, title, company, tier, description, pay_rate, token_cost, external_url)
select *
from (
  values
    ('t1-data-entry', 'Remote Data Entry Specialist', 'Northline Operations', 1, 'Transfer invoice fields into the operations sheet. The queue is fully remote, with a written checklist and no phone support.', '$18/hr', 0, null),
    ('t1-ea', 'Virtual Executive Assistant', 'Harbor & Co.', 1, 'Keep a founder''s calendar, draft short emails, and maintain a weekly task list.', '$22/hr', 0, null),
    ('t1-catalog', 'Catalog QA Associate', 'Fieldnote', 1, 'Compare product listings with source photos and flag mismatches.', '$16/hr', 0, null),
    ('t2-annotator', 'Senior Data Annotator', 'Meridian Labs', 2, 'Label text and image samples against a client rubric. The token covers the client introduction.', '$25/hr', 10, null),
    ('t2-audio', 'Audio Quality Evaluator', 'Lumen Audio', 2, 'Score speech clips for clarity, noise, and instruction match.', '$20/hr', 10, null),
    ('t2-survey', 'Research Survey Coder', 'Halcyon Research', 2, 'Code open-ended survey responses into a fixed taxonomy.', '$28/hr', 15, null),
    ('t3-outlier', 'AI Training & RLHF Specialist', 'Outlier AI', 3, 'Rank, write, and critique model outputs on Outlier.', '$30–$50/hr', 0, 'https://outlier.ai/'),
    ('t3-handshake', 'Data Collector & Reviewer', 'Handshake Data Annotation', 3, 'Collect and review data for Handshake AI projects.', '$22/hr', 0, 'https://ai.joinhandshake.com/get-started')
) as seed(id, title, company, tier, description, pay_rate, token_cost, external_url)
where not exists (select 1 from public.jobs);

alter table public.jobs enable row level security;
grant select on table public.jobs to anon, authenticated;

drop policy if exists "Anyone can read active jobs" on public.jobs;
create policy "Anyone can read active jobs"
  on public.jobs
  for select
  to anon, authenticated
  using (is_active = true);
