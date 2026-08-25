-- Lets an installer accept/reject a job they've been booked into (see
-- src/app/jobs/actions.ts) — separate from `install_status`, which tracks
-- physical progress (scaffold, in-progress, completed) and is only ever set
-- once installation has actually started. This tracks whether the
-- installer themselves has confirmed the booking at all.
--
-- Set to 'pending' the moment a job is assigned (assignInstallerToJobAction)
-- and cleared back to null when unassigned (unassignInstallerFromJobAction)
-- — so it never carries a stale accept/reject from a previous installer
-- into a fresh assignment.
--
-- Safe to re-run.

alter table public.quotes add column if not exists install_acceptance_status text
  check (install_acceptance_status in ('pending', 'accepted', 'rejected'));
