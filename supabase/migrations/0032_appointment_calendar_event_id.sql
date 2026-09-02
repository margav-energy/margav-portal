-- Stores the Google Calendar event id created for an appointment (see
-- createAppointmentCalendarEvent, src/lib/google-calendar.ts), so it can be
-- deleted again when the appointment is superseded by a rebook or removed
-- outright — without this, Lucy's calendar kept the old event forever
-- alongside the new one, showing every rebooked appointment twice.
--
-- Null whenever the integration is unconfigured or the create call failed —
-- both already-handled, fail-soft cases (see google-calendar.ts's doc
-- comment), not something this needs to backfill.
--
-- Safe to re-run.

alter table public.appointments
  add column if not exists google_calendar_event_id text;
