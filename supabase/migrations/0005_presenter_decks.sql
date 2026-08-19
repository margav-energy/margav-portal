-- Admin-uploaded sales deck for the quote Presenter (src/app/quotes/[id]/presenter).
-- An admin uploads a .pptx (converted to per-slide PNGs via CloudConvert —
-- see src/app/settings/presenter-deck/actions.ts); the Presenter shows
-- those images full-bleed, with 3 slide slots reserved for live, per-quote
-- React components (System Summary / Pricing / Monthly Cost) rather than
-- baked-in images.
--
-- Only one deck is ever "active" — re-uploading flips the previous one to
-- inactive rather than deleting it, so past decks stay around for audit
-- (matching this app's existing activities/quote_history pattern).
--
-- RLS here is permissive read/write for any signed-in user, matching every
-- other table in this schema — `profiles.role` isn't DB-enforced anywhere
-- yet (see the note further up this file's history), so admin-only writes
-- are gated in the Server Actions instead, not here.
--
-- Storage buckets (`presenter-decks` for the raw .pptx, `presenter-slides`
-- for the converted PNGs) can't be created from SQL — create both as
-- *private* buckets via Supabase Dashboard → Storage → New bucket, using
-- exactly those two names. This is the first Storage usage in this app —
-- note that a private bucket denies ALL access, even to signed-in users,
-- until a storage.objects policy says otherwise (see the bottom of this
-- file), so create the buckets *and* run this whole file.
--
-- Safe to re-run.

create table if not exists public.presenter_decks (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references public.profiles (id),
  original_filename text not null,
  pptx_storage_path text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Enforces "only one active deck at a time" — uploading a new one must
-- flip the old row to is_active = false in the same transaction.
create unique index if not exists idx_presenter_decks_single_active
  on public.presenter_decks (is_active)
  where is_active;

create table if not exists public.presenter_slides (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.presenter_decks (id) on delete cascade,
  position integer not null,
  slide_type text not null
    check (slide_type in ('image', 'quote_system_summary', 'quote_pricing', 'quote_monthly_cost')),
  -- Only set for slide_type = 'image'; the 3 quote_* rows are markers with
  -- no image — the Presenter renders a live component for those instead.
  image_storage_path text,
  created_at timestamptz not null default now(),
  unique (deck_id, position)
);

-- Same "any authenticated teammate can do anything" policy as every other
-- business table (see schema.sql's RLS section) — admin-only writes are
-- gated in the Server Actions instead, not here.
alter table public.presenter_decks enable row level security;
alter table public.presenter_slides enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['presenter_decks', 'presenter_slides']
  loop
    execute format('drop policy if exists "%1$s_all_authenticated" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_all_authenticated" on public.%1$s for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- Storage access — same permissive "any signed-in teammate" policy, applied
-- to storage.objects and scoped to just these two buckets by bucket_id.
-- Requires the `presenter-decks` and `presenter-slides` buckets to already
-- exist (created via the Dashboard, see the note above) — this only grants
-- access to them, it doesn't create them.
drop policy if exists "presenter_decks_bucket_all_authenticated" on storage.objects;
create policy "presenter_decks_bucket_all_authenticated"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'presenter-decks')
  with check (bucket_id = 'presenter-decks');

drop policy if exists "presenter_slides_bucket_all_authenticated" on storage.objects;
create policy "presenter_slides_bucket_all_authenticated"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'presenter-slides')
  with check (bucket_id = 'presenter-slides');
