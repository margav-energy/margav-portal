-- Solar gets its own Installation Agreement and Cooling-Off Waiver (the boiler ones are written for a boiler install),
-- so the two new document types are allowed on signature_requests alongside the existing three.

alter table public.signature_requests
  drop constraint if exists signature_requests_document_type_check;

alter table public.signature_requests
  add constraint signature_requests_document_type_check
  check (document_type in (
    'quote',
    'boiler_installation_agreement',
    'cooling_off_waiver',
    'solar_installation_agreement',
    'solar_cooling_off_waiver'
  ));
