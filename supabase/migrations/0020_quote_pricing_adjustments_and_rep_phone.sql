-- Two additions to back the "System Summary" / "Get In Touch" sections of
-- the quote document (see src/lib/esignature/document.ts,
-- src/components/esignature/QuoteSummarySidebarCard.tsx):
--
-- 1. `quotes.vat_amount` / `discount_amount` / `deposit_amount` — the
--    subtotal (sum of line items, what `totalPriceLabel` used to mean) is
--    still computed live; these three are the only figures on that summary
--    that need to be entered by a human rather than derived. `vat_amount`
--    is informational only ("Included VAT" — this business quotes
--    VAT-inclusive prices, so it's never added on top); the real total is
--    subtotal minus discount.
-- 2. `profiles.phone` — self-service, same as `full_name` (see
--    updateProfileAction, src/app/settings/actions.ts) — lets "Get In
--    Touch" show a real number instead of nothing.
--
-- Safe to re-run.

alter table public.quotes add column if not exists vat_amount numeric(12, 2) not null default 0;
alter table public.quotes add column if not exists discount_amount numeric(12, 2) not null default 0;
alter table public.quotes add column if not exists deposit_amount numeric(12, 2) not null default 0;

alter table public.profiles add column if not exists phone text;
