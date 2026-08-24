-- Adds installer self-service day availability, backing the new
-- "My Availability" (installer) and "Installer Availability" (admin grid)
-- pages. Installers are a new portal login role (see src/data/current-user.ts,
-- src/app/availability/{page,actions}.tsx) — this is deliberately NOT folded
-- into `holidays` (schema.sql): holidays are rep time-off requests that go
-- through an admin approve/reject workflow with postcode coverage impact;
-- installer availability is a plain self-reported day-by-day calendar with
-- no approval step, consumed only as read-only reference by admins doing
-- manual job scheduling (see src/data/installer-availability-service.ts).
--
-- Row *presence* for a (installer_id, date) pair — not just `status` — is
-- what the 14-day rolling nudge banner checks: no row means "hasn't told us
-- yet" (nudge), a row with status='unavailable' means "told us, and they're
-- off" (don't nudge, but do surface it to admins), status='available' means
-- "told us, free that day".
--
-- Safe to re-run.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'rep', 'installer'));

create table if not exists public.installer_availability (
  id uuid primary key default gen_random_uuid(),
  installer_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  status text not null check (status in ('available', 'unavailable')),
  note text,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (installer_id, date)
);

create index if not exists idx_installer_availability_date
  on public.installer_availability (date);
create index if not exists idx_installer_availability_installer
  on public.installer_availability (installer_id, date);

alter table public.installer_availability enable row level security;

drop policy if exists "installer_availability_all_authenticated" on public.installer_availability;
create policy "installer_availability_all_authenticated" on public.installer_availability
  for all to authenticated using (true) with check (true);
