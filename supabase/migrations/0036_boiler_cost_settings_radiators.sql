-- Adds "Radiators" as a costed Extras catalog entry (src/lib/extras-catalog.ts)
-- — sold at £200 each, includes thermostatic TRVs — costing Margav £140
-- each, same "optional per job, scaled by quantity" treatment as Roof kit/
-- Gas run per metre/Flue extension per metre (see 0024_boiler_cost_settings_flue_and_extras.sql).
--
-- Merges into the existing `extra_costs_by_name` map (`||`) rather than
-- overwriting it outright, so it doesn't clobber any extra an admin has
-- since added via Settings → Boiler Install Costs.
--
-- Safe to re-run.

update public.boiler_cost_settings
set extra_costs_by_name = extra_costs_by_name || '{"Radiators": 140}'::jsonb
where id = true;
