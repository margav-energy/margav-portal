-- Solar install photo checklist ("Solar Image Checklist.pdf"): the installer
-- attaches photos against each PRE / MID / POST item (or marks it N/A), then
-- submits the whole thing to the admins to check. One checklist per quote.
--
-- Photos go in the existing private `boiler-survey-photos` bucket under
-- `solar-install/<checklist id>/...` (same bucket the surveys use — no new
-- bucket or storage policy needed). They're uploaded straight from the
-- browser to Storage via signed upload URLs.
--
-- Safe to re-run.

create table if not exists public.solar_install_checklists (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  -- Item keys the installer marked "N/A" (see src/lib/solar-install-checklist.ts).
  na_items jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  submitted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.solar_install_checklist_photos (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.solar_install_checklists (id) on delete cascade,
  item_key text not null,
  storage_path text not null,
  file_name text not null default '',
  content_type text not null default '',
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id),
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_solar_install_checklists_quote on public.solar_install_checklists (quote_id);
create index if not exists idx_solar_install_checklist_photos_checklist_item
  on public.solar_install_checklist_photos (checklist_id, item_key);

alter table public.solar_install_checklists enable row level security;
alter table public.solar_install_checklist_photos enable row level security;

drop policy if exists "solar_install_checklists_all_authenticated" on public.solar_install_checklists;
create policy "solar_install_checklists_all_authenticated" on public.solar_install_checklists
  for all to authenticated using (true) with check (true);

drop policy if exists "solar_install_checklist_photos_all_authenticated" on public.solar_install_checklist_photos;
create policy "solar_install_checklist_photos_all_authenticated" on public.solar_install_checklist_photos
  for all to authenticated using (true) with check (true);
