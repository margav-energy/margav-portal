-- Copies of the design images and proposal PDF pulled from a quote's Easy PV
-- project (src/data/easypv-files-service.ts). The files live in the private
-- `boiler-survey-photos` bucket under `easypv/<quote id>/...` and are read
-- through signed URLs after the server has checked the caller may open the
-- quote — so RLS is enabled with NO policies: only the service role (which
-- the server uses after its own authorisation check) can touch these rows.
--
-- Safe to re-run.

create table if not exists public.easypv_files (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  -- Easy PV's own grouping: 'images' (design snapshots, satellite maps) or 'uploads' (proposal / reports).
  category text not null check (category in ('images', 'uploads')),
  -- The group inside the category (e.g. 'other', 'quotation').
  group_name text not null default '',
  source_name text not null,
  storage_path text not null,
  content_type text not null default '',
  size_bytes bigint not null default 0,
  -- Easy PV's modified time for the file.
  source_modified_at timestamptz,
  synced_at timestamptz not null default now(),
  unique (quote_id, category, group_name, source_name)
);

create index if not exists idx_easypv_files_quote on public.easypv_files (quote_id);

alter table public.easypv_files enable row level security;
