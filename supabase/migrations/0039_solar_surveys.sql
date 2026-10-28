-- Pre-installation survey for solar quotes (the "Survey" action button on
-- SolarQuoteDetail), mirroring "Pre-Installation Survey _ Margav.pdf".
--
-- Same flow and security model as 0007_boiler_surveys.sql: one row per quote,
-- an unguessable `access_token` the customer/surveyor opens at
-- `/survey/[token]` with no portal login, NO anon RLS policy (the public route
-- reads/writes through the service-role client, hand-filtered by token), and
-- full access for authenticated portal staff.
--
-- Unlike the boiler survey, the answers live in one `answers` jsonb document
-- rather than a column per question — this form has repeating roof sections
-- (up to three) and is likely to keep changing as the install team refines it.
--
-- Uploads (photos, videos, the energy bill PDF) go in the existing private
-- `boiler-survey-photos` bucket under `solar/<survey id>/...`, so no new
-- bucket or storage policy is needed. They are uploaded straight from the
-- browser to Storage via signed upload URLs (videos are too large to pass
-- through a Server Action). NOTE: the bucket's own "file size limit" (Supabase
-- Dashboard → Storage → bucket settings) must be high enough for walkaround
-- videos.
--
-- Safe to re-run.

create table if not exists public.solar_surveys (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes (id) on delete cascade,
  access_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'submitted')),
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.solar_survey_files (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.solar_surveys (id) on delete cascade,
  item_key text not null,
  storage_path text not null,
  file_name text not null default '',
  content_type text not null default '',
  size_bytes bigint,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_solar_surveys_quote on public.solar_surveys (quote_id);
create index if not exists idx_solar_survey_files_survey_item on public.solar_survey_files (survey_id, item_key);

alter table public.solar_surveys enable row level security;
alter table public.solar_survey_files enable row level security;

drop policy if exists "solar_surveys_all_authenticated" on public.solar_surveys;
create policy "solar_surveys_all_authenticated" on public.solar_surveys
  for all to authenticated using (true) with check (true);

drop policy if exists "solar_survey_files_all_authenticated" on public.solar_survey_files;
create policy "solar_survey_files_all_authenticated" on public.solar_survey_files
  for all to authenticated using (true) with check (true);
