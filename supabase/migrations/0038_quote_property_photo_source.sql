-- Records where a quote's property photo (0023_quote_property_photo.sql)
-- came from, so editing the customer's address can swap an auto-fetched
-- Street View photo for one of the new address without ever clobbering a
-- photo a rep uploaded by hand (see `refreshStreetViewPhotoForQuote`,
-- src/data/property-photo-service.ts).
--
-- Backfill: existing photos have no recorded source, so any quote whose
-- activity log shows a manual upload is marked 'upload' and every other
-- photo 'street_view' (the auto-fetch at quote creation is the only other
-- way one gets there).
--
-- Safe to re-run.

alter table public.quotes add column if not exists property_photo_source text
  check (property_photo_source in ('street_view', 'upload'));

update public.quotes q
set property_photo_source = case
  when exists (
    select 1 from public.activities a
    where a.entity_type = 'quote_property_photo'
      and a.entity_id::text = q.id::text
      and a.description like '%uploaded a property photo%'
  ) then 'upload'
  else 'street_view'
end
where q.property_photo_path is not null
  and q.property_photo_source is null;
