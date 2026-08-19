-- Simplifies `quotes.selected_payment_method` down to the two real options
-- ("Bacs" and "Monthly Plan") and adds the plan's term length. The old
-- 5-option enum (monthly_plan_15yr / interest_free_credit_3yr /
-- hometree_25yr / buy_now_pay_later) is replaced by a single "monthly_plan"
-- value plus a separate `monthly_plan_term_years` column — the term the rep
-- picks (1/2/3/4/5/10 years), with APR computed in the app (0% for 1 year,
-- 9.9% for 2-10 years — see src/lib/finance.ts).
--
-- Safe to re-run.

alter table public.quotes drop constraint if exists quotes_selected_payment_method_check;

alter table public.quotes add column if not exists monthly_plan_term_years integer;

-- Migrate any existing rows onto the new two-value model before the
-- stricter constraint goes back on.
update public.quotes
set selected_payment_method = 'monthly_plan',
    monthly_plan_term_years = coalesce(monthly_plan_term_years, 10)
where selected_payment_method in ('monthly_plan_15yr', 'hometree_25yr');

update public.quotes
set selected_payment_method = 'bacs'
where selected_payment_method is not null
  and selected_payment_method not in ('bacs', 'monthly_plan');

alter table public.quotes add constraint quotes_selected_payment_method_check
  check (selected_payment_method in ('bacs', 'monthly_plan'));

alter table public.quotes drop constraint if exists quotes_monthly_plan_term_years_check;
alter table public.quotes add constraint quotes_monthly_plan_term_years_check
  check (monthly_plan_term_years is null or monthly_plan_term_years in (1, 2, 3, 4, 5, 10));
