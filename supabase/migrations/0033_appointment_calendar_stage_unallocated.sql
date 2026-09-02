-- Adds "unallocated" as a valid `calendar_stage` value. The calendar used
-- to have no distinct stage for "nobody assigned yet" — it reused
-- "allocated" for both that and "assigned to a rep, awaiting acceptance",
-- which is why the calendar kept showing an already-allocated appointment
-- as if nobody was on it. Splitting them out (see `AppointmentStage` in
-- src/types/calendar-appointment.ts and `deriveCalendarStage` in
-- src/data/appointments-service.ts) needs the DB's check constraint to
-- actually allow the new value — without this, every new appointment
-- fails to save with "violates check constraint appointments_calendar_stage_check".
--
-- Safe to re-run.

alter table public.appointments
  drop constraint if exists appointments_calendar_stage_check;

alter table public.appointments
  add constraint appointments_calendar_stage_check
  check (calendar_stage in ('unallocated', 'allocated', 'booked', 'confirmed', 'not_pitched', 'pitch_and_miss', 'sold'));
