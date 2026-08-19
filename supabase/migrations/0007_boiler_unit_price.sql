-- Adds a dedicated price to each boiler unit.
--
-- Previously a boiler unit (public.boiler_units) had no price of its own —
-- only its nested `items` (line items added inside the Add/Edit boiler
-- modal) contributed to the "Boiler + install" pricing total, so a boiler
-- with no manually-added line item showed £0 everywhere. This column is a
-- first-class price field, shown on the boiler card (BoilerUnitsSection.tsx)
-- and folded into the total alongside `items` (see unitsTotal in
-- src/data/quotes-service.ts).
--
-- Safe to re-run.

alter table public.boiler_units
  add column if not exists price numeric(12, 2) not null default 0;
