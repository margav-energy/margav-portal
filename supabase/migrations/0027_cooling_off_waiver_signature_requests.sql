-- Extends the self-hosted e-signature flow (see
-- 0012_agreement_signature_requests.sql) to also cover the fixed
-- "Cooling-Off Waiver" T&Cs document
-- (assets/agreement-templates/cooling-off-waiver.pdf) — same
-- `signature_requests` table, same `/sign/[token]` public route, just a
-- third `document_type` value (see src/lib/esignature/waiver-{document,pdf}.ts).
--
-- Safe to re-run.

alter table public.signature_requests drop constraint if exists signature_requests_document_type_check;
alter table public.signature_requests add constraint signature_requests_document_type_check
  check (document_type in ('quote', 'boiler_installation_agreement', 'cooling_off_waiver'));
