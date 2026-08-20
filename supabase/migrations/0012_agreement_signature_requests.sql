-- Extends the self-hosted e-signature flow (see 0010_self_signed_documents.sql)
-- to also cover the fixed "Boiler Installation Agreement" T&Cs document
-- (assets/agreement-templates/boiler-installation-agreement.pdf), not just
-- the dynamically-generated quote document. Same `/sign/[token]` public
-- route, same `signature_requests` table — `document_type` says which kind
-- of document `document_snapshot` describes and which renderer builds the
-- final PDF (see src/lib/esignature/{document,agreement-pdf}.ts).
--
-- The rep's side of the agreement reuses their saved Settings signature
-- (see 0011_profile_signatures.sql) — stamped in automatically once the
-- customer signs, no separate rep link needed.
--
-- Safe to re-run.

alter table public.signature_requests
  add column if not exists document_type text not null default 'quote';

alter table public.signature_requests drop constraint if exists signature_requests_document_type_check;
alter table public.signature_requests add constraint signature_requests_document_type_check
  check (document_type in ('quote', 'boiler_installation_agreement'));
