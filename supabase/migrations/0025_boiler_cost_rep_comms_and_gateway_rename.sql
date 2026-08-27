-- Two follow-ups to 0024_boiler_cost_settings_flue_and_extras.sql:
--
--   1. `cost_per_sale` turned out to be the same £300 concept as
--      `commission` — Margav only tracks one flat "Rep Comms" cost per
--      install, not two. Dropping the now-redundant column rather than
--      keeping a second field nobody fills in differently.
--
--   2. The Gateway extra is called "Smart Touch", not "Comfort Touch" —
--      renaming its name everywhere it's stored as a live, editable value:
--      the Extras catalog entry (code, not DB) and any *unsent* quote's
--      saved "extra" line item. A quote that's already been sent keeps
--      whatever name was locked into its `signature_requests.document_snapshot`
--      at send-time (an immutable record of what the customer actually
--      signed) — this migration deliberately does not touch that.
--
-- Safe to re-run.

alter table public.boiler_cost_settings drop column if exists cost_per_sale;

update public.quote_line_items
set name = 'Gateway with Smart Touch'
where section = 'extra' and name = 'Gateway with Comfort Touch';
