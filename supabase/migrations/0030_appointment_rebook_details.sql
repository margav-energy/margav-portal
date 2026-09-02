-- Stores the discrete address lines and the exact product the rep selected
-- alongside the existing flattened `address` string and `product_type`
-- ("solar"/"boiler") classification — both of those are lossy (the address
-- can't be split back into line1/line2/line3/city/county, and product_type
-- collapses e.g. "Solar & Battery" and "EV Charger" down to just "solar").
--
-- Populated going forward by `createAppointment` (see
-- src/data/appointments-service.ts); existing rows keep these columns null,
-- and `getAppointmentForRebook` falls back to the flattened `address` /
-- `product_type` for appointments created before this migration.
--
-- Safe to re-run.

alter table public.appointments
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists address_line3 text,
  add column if not exists city text,
  add column if not exists county text,
  add column if not exists product text;
