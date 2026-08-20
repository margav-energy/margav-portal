-- Self-hosted e-signature, replacing Dropbox Sign. "Send Quote" now creates a
-- row here (locked document snapshot + hash, generated at send-time) and
-- emails the customer a link to `/sign/[access_token]` — a public,
-- unauthenticated page (same shape as `/survey/[token]`, see
-- 0007_boiler_surveys.sql) where they draw/type a signature. On submit, the
-- server renders a final signed PDF (document + signature + audit footer)
-- and performs the same "mark quote signed" side effects the Dropbox Sign
-- webhook used to (see src/app/api/dropbox-sign/webhook/route.ts, now
-- removed) — all synchronously in one request, no webhook needed since
-- there's no external provider to call back from.
--
-- Multiple rows per quote are allowed (not unique on quote_id) — re-sending
-- creates a fresh row/token rather than reusing one, so the full history
-- stays auditable. Only the most recent row per quote drives what the
-- portal UI shows.
--
-- Security note: same reasoning as `boiler_surveys` — these get NO anon RLS
-- policy. The public `/sign/[token]` route reads/writes through the
-- service-role client (`src/lib/supabase/service.ts`), with every query
-- hand-filtered by `access_token` in application code.
--
-- Storage: two *private* buckets, `signature-images` (the raw drawn
-- signature PNG) and `signed-documents` (the final generated PDF) — created
-- via the Storage API by the setup script, not from SQL (same limitation
-- noted in 0005_presenter_decks.sql / 0007_boiler_surveys.sql).
--
-- Safe to re-run.

create table if not exists public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  access_token text not null unique default encode(gen_random_bytes(24), 'hex'),

  signer_name text not null,
  signer_email text not null,

  -- Locked at send-time — see src/lib/esignature/document.ts. The signing
  -- page renders this, never a live re-fetch of the quote.
  document_snapshot jsonb not null,
  document_hash text not null,

  status text not null default 'pending' check (status in ('pending', 'viewed', 'signed', 'declined', 'expired')),

  sent_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,

  signer_typed_name text,
  signature_image_path text,
  signed_pdf_path text,
  signer_ip text,
  signer_user_agent text,

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_signature_requests_quote on public.signature_requests (quote_id, created_at desc);

alter table public.signature_requests enable row level security;

drop policy if exists "signature_requests_all_authenticated" on public.signature_requests;
create policy "signature_requests_all_authenticated" on public.signature_requests
  for all to authenticated using (true) with check (true);

-- Storage access for portal staff viewing signatures/signed PDFs. Requires
-- the `signature-images` / `signed-documents` buckets to already exist.
drop policy if exists "signature_images_bucket_all_authenticated" on storage.objects;
create policy "signature_images_bucket_all_authenticated"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'signature-images')
  with check (bucket_id = 'signature-images');

drop policy if exists "signed_documents_bucket_all_authenticated" on storage.objects;
create policy "signed_documents_bucket_all_authenticated"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'signed-documents')
  with check (bucket_id = 'signed-documents');
