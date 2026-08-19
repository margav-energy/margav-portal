-- Links an auto-created quote back to the appointment that spawned it.
--
-- Creating an appointment (createAppointmentAction in
-- src/components/appointments/actions.ts) now also creates a matching
-- "new_lead" quote (createQuoteForAppointment in
-- src/components/quotes/actions.ts) so the Quotes section stays in sync
-- with the Appointments pipeline.
--
-- Nullable: quotes created directly via the "New Quote" modal have no
-- appointment behind them. The partial unique index means each appointment
-- can back at most one auto-created quote, while NULLs (manually created
-- quotes) never collide with each other.
--
-- Safe to re-run.

alter table public.quotes
  add column if not exists appointment_id uuid references public.appointments (id) on delete set null;

create unique index if not exists idx_quotes_appointment_id_unique
  on public.quotes (appointment_id)
  where appointment_id is not null;
