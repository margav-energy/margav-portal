-- Extends the boiler cost model (see 0010_boiler_cost_settings.sql) with
-- two things Margav's cost sheet actually needs:
--   1. `standard_flue` — a new always-included fixed cost, same treatment
--      as `fernox_system_filter`/`gateway_comfort_touch` (every boiler
--      install gets one, so it's flat regardless of whether a rep
--      itemizes "Standard 60/100 Flue" as an Extras line on the quote).
--   2. `extra_costs_by_name` — real supplier cost for specific "Extras"
--      catalog entries (src/lib/extras-catalog.ts) that are genuinely
--      optional per job (Roof kit, Gas run per metre, Flue extension per
--      metre) — unlike the fixed items above, these only count toward a
--      quote's cost price when actually added as an extra, scaled by
--      quantity. Same jsonb-map shape as `unit_costs_by_kw` so a new
--      costed extra can be added without a migration; keyed by the
--      catalog entry's exact `name` string (see `extraCostsByName` in
--      src/lib/boiler-install-cost.ts).
--
-- Also refreshes the singleton row's figures to Margav's current cost
-- sheet (boiler unit costs by kW, Fernox Filter, Gateway) — this is real
-- business data being corrected, not a schema-only change, so the update
-- below intentionally overwrites whatever's currently stored.
--
-- Safe to re-run.

alter table public.boiler_cost_settings add column if not exists standard_flue numeric not null default 0;
alter table public.boiler_cost_settings add column if not exists extra_costs_by_name jsonb not null default '{}'::jsonb;

update public.boiler_cost_settings
set
  unit_costs_by_kw = '{"24": 810.36, "30": 875.36, "36": 973.12}'::jsonb,
  fernox_system_filter = 93.60,
  gateway_comfort_touch = 139.88,
  standard_flue = 54.08,
  extra_costs_by_name = '{"Roof kit": 87.36, "Gas run per metre": 35.88, "Flue extension per metre": 35.88}'::jsonb
where id = true;
