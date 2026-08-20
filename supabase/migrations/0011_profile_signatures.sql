-- A rep's own saved signature (Settings → "My signature"), stamped
-- automatically onto every quote they're the assigned rep for, once the
-- customer signs — see src/data/signature-service.ts (`performSignedSideEffects`)
-- and src/lib/esignature/pdf.tsx. No per-quote signing step for the rep.
--
-- Storage: private bucket `profile-signatures`, one object per rep at
-- `{profile_id}/signature.png`, created via the Storage API by the setup
-- script (not from SQL — same limitation noted in 0007_boiler_surveys.sql).
--
-- Safe to re-run.

alter table public.profiles
  add column if not exists signature_image_path text;

drop policy if exists "profile_signatures_bucket_all_authenticated" on storage.objects;
create policy "profile_signatures_bucket_all_authenticated"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'profile-signatures')
  with check (bucket_id = 'profile-signatures');
