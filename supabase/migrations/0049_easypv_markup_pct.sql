-- The markup % used when a quote's items were last imported from Easy PV (importEasyPvItems),
-- so the Easy PV card can check the quote's imported items still add up to Easy PV's materials
-- plus that markup. Safe to re-run.

alter table public.quotes add column if not exists easypv_markup_pct numeric(6, 2);
