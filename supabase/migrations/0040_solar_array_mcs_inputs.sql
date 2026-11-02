-- Inputs the MCS performance estimate needs per solar array (MCS 032:2025 §3,
-- MIS 3002 Appendix B): kWp = module label watts (Wp at STC) x module count,
-- and orientation as degrees from due south (0 = south, 90 = east/west,
-- 180 = north) so the Kk tables can be looked up. `orientation` (free text)
-- stays as the display label.
--
-- Existing arrays keep module_wp / module_count = 0 and orientation_degrees
-- null; the quote's MCS estimate lists what's missing until an admin fills
-- them in.
--
-- Safe to re-run.

alter table public.solar_arrays add column if not exists module_wp integer not null default 0
  check (module_wp >= 0);
alter table public.solar_arrays add column if not exists module_count integer not null default 0
  check (module_count >= 0);
alter table public.solar_arrays add column if not exists orientation_degrees numeric(5, 1)
  check (orientation_degrees between 0 and 180);
