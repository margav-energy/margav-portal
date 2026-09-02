-- Catch-up migration bundling 0031–0033 into one file to run — covers:
--   1. Manual per-rep calendar colour (profiles.calendar_color)
--   2. Stored Google Calendar event id on appointments, so a rebook/delete
--      can remove the old calendar event instead of leaving it behind
--      alongside the new one (appointments.google_calendar_event_id)
--   3. Allowing the new "unallocated" calendar_stage value — without this,
--      every new appointment fails to save with
--      "violates check constraint appointments_calendar_stage_check"
--
-- Every statement is guarded (add column if not exists / drop constraint if
-- exists), so this is safe to run even if some of 0031–0033 already applied.

-- 1. supabase/migrations/0031_profile_calendar_color.sql
alter table public.profiles
  add column if not exists calendar_color text;

-- 2. supabase/migrations/0032_appointment_calendar_event_id.sql
alter table public.appointments
  add column if not exists google_calendar_event_id text;

-- 3. supabase/migrations/0033_appointment_calendar_stage_unallocated.sql
alter table public.appointments
  drop constraint if exists appointments_calendar_stage_check;

alter table public.appointments
  add constraint appointments_calendar_stage_check
  check (calendar_stage in ('unallocated', 'allocated', 'booked', 'confirmed', 'not_pitched', 'pitch_and_miss', 'sold'));
