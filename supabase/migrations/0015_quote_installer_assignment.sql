-- Lets an admin book a signed job to an installer on a specific day, from
-- the "Installer Availability" grid (src/app/appointments/installer-availability).
-- `installer_id` says who's doing the job; `install_date` says when — both
-- are needed because clicking a specific day cell in the grid pins the job
-- to that day, not just to a person (see src/app/appointments/installer-availability/actions.ts).
--
-- Assigning a quote also stamps `install_status` to 'awaiting_scaffold' if
-- it's still null (see 0000 schema.sql — nothing else sets install_status
-- today except the hardcoded "Cancel App" -> 'cancelled' path in
-- src/components/quotes/actions.ts).
--
-- Safe to re-run.

alter table public.quotes add column if not exists installer_id uuid references public.profiles (id);
alter table public.quotes add column if not exists install_date date;

create index if not exists idx_quotes_installer_install_date on public.quotes (installer_id, install_date);
