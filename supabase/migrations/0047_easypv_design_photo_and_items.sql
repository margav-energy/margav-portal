-- Connects a quote to its Easy PV design more deeply:
--   * the quote's design image (quotes.property_photo_path — the "Solar
--     design" card) can now come from Easy PV: property_photo_source gains
--     'easypv', and easypv_photo_name remembers which Easy PV snapshot is
--     currently applied so a refresh only swaps it when a newer one exists
--     (src/data/easypv-files-service.ts).
--   * easypv_items_imported_at records when the Easy PV cart was last
--     imported into the quote's items (see importEasyPvItems in
--     src/components/quotes/easypv-actions.ts).
--
-- Safe to re-run.

alter table public.quotes drop constraint if exists quotes_property_photo_source_check;
alter table public.quotes add constraint quotes_property_photo_source_check
  check (property_photo_source in ('street_view', 'upload', 'easypv'));

alter table public.quotes
  add column if not exists easypv_photo_name text,
  add column if not exists easypv_items_imported_at timestamptz;
