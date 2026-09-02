-- Lets an admin pick a fixed calendar colour per teammate (Settings → Team
-- Members) instead of always relying on the automatic name-hash colour used
-- as a fallback — see `repColorFor` in src/lib/rep-colors.ts.
--
-- Null means "no manual colour set" — the calendar falls back to its
-- deterministic per-name colour, so this never needs to be backfilled.
--
-- Safe to re-run.

alter table public.profiles
  add column if not exists calendar_color text;
