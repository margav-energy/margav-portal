-- A single site/property photo per quote, shown next to Customer details
-- on the quote detail page (see PropertyPhotoCard.tsx — replaces the old
-- static PropertyImagePlaceholder). There is no automated fetch of this
-- from the address anywhere in the app (nothing like Google Street View is
-- wired up) — this is a plain manual upload, same shape as
-- `profiles.signature_image_path`: one deterministic storage path per
-- row, upserted/replaced in place rather than versioned.
--
-- Storage: the private `property-photos` bucket can't be created from SQL
-- (same limitation as every other bucket in this app) — self-provisioned
-- on first upload via `uploadPropertyPhotoAction`
-- (src/app/quotes/[id]/property-photo-actions.ts).
--
-- Safe to re-run.

alter table public.quotes add column if not exists property_photo_path text;

-- Applies as soon as the bucket exists — normally self-provisioned on first
-- upload (see note above), so this policy is usually ready before there's
-- ever an object to check it against. Same pattern as
-- quote_documents_bucket_all_authenticated (0019_quote_documents.sql).
drop policy if exists "property_photos_bucket_all_authenticated" on storage.objects;
create policy "property_photos_bucket_all_authenticated"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'property-photos')
  with check (bucket_id = 'property-photos');
