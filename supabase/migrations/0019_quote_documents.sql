-- Lets an admin/rep attach an arbitrary file to a quote — e.g. a filled-in
-- boiler quote PDF prepared outside the portal, a scanned signed copy, or
-- any other document worth keeping with the record. Separate from
-- `signature_requests` (0010_self_signed_documents.sql), which only ever
-- holds PDFs the portal itself generated through the e-signature flow —
-- this is for whatever an admin drags in by hand.
--
-- Storage: the private `quote-documents` bucket can't be created from SQL
-- (same limitation noted in 0007_boiler_surveys.sql), but unlike that one
-- there's no manual dashboard step needed here — `uploadQuoteDocumentAction`
-- (src/app/quotes/[id]/documents-actions.ts) self-provisions the bucket via
-- the service-role Storage API the first time anyone uploads a document.
--
-- Safe to re-run.

create table if not exists public.quote_documents (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  uploaded_by uuid references public.profiles (id),
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_quote_documents_quote on public.quote_documents (quote_id, uploaded_at desc);

alter table public.quote_documents enable row level security;

drop policy if exists "quote_documents_all_authenticated" on public.quote_documents;
create policy "quote_documents_all_authenticated" on public.quote_documents
  for all to authenticated using (true) with check (true);

-- Applies as soon as the bucket exists — normally self-provisioned on
-- first upload (see note above), so this policy is usually ready before
-- there's ever an object to check it against.
drop policy if exists "quote_documents_bucket_all_authenticated" on storage.objects;
create policy "quote_documents_bucket_all_authenticated"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'quote-documents')
  with check (bucket_id = 'quote-documents');
