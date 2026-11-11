-- Whether a quote's deposit is paid up front (the Monthly Plan then finances only the rest) or is itself
-- included in the finance (the Monthly Plan is worked out on the whole price). Defaults to paid up front,
-- which is what a deposit normally means; see financedAmount in src/lib/finance.ts. Safe to re-run.

alter table public.quotes add column if not exists deposit_paid_upfront boolean not null default true;
