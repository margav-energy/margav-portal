-- Which pages of the Easy PV customer proposal PDF to leave out when the
-- portal builds the quote it sends — normally the Easy PV "Quote" page (and
-- anything else priced at Midsummer's cost), which the portal's own quote
-- sheet replaces. Free text such as "9" or "9-11, 14"; see
-- src/lib/proposal-pages.ts. Safe to re-run.

alter table public.quotes add column if not exists easypv_proposal_skip_pages text;
