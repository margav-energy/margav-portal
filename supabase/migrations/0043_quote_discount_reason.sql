-- Why a discount was given (Flexible Installation, Price Match, …), picked on the Pricing card.
-- Empty string = no reason recorded. Safe to re-run.

alter table public.quotes add column if not exists discount_reason text not null default '';
