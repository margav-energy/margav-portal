-- Quote notes: replies, edits and attachments.
--   parent_id  — a reply points at the note it answers (deleting a note deletes its replies).
--   edited_at  — set when the author edits the text, shown as "edited".
--   quote_note_attachments — PDFs / images / videos on a note. The files live in the private
--     `quote-note-attachments` Storage bucket, which the app creates on first upload.
-- Safe to re-run.

alter table public.quote_notes add column if not exists parent_id uuid
  references public.quote_notes (id) on delete cascade;
alter table public.quote_notes add column if not exists edited_at timestamptz;

create index if not exists quote_notes_parent_id_idx on public.quote_notes (parent_id);

create table if not exists public.quote_note_attachments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.quote_notes (id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  content_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists quote_note_attachments_note_id_idx on public.quote_note_attachments (note_id);

alter table public.quote_note_attachments enable row level security;
drop policy if exists "quote_note_attachments_all_authenticated" on public.quote_note_attachments;
create policy "quote_note_attachments_all_authenticated" on public.quote_note_attachments
  for all to authenticated using (true) with check (true);

-- Storage access for the `quote-note-attachments` bucket (the app creates the bucket on first
-- upload; without this policy, uploads are refused by row-level security).
drop policy if exists "quote_note_attachments_bucket_all_authenticated" on storage.objects;
create policy "quote_note_attachments_bucket_all_authenticated"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'quote-note-attachments')
  with check (bucket_id = 'quote-note-attachments');
