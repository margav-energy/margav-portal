-- The electrician accepts/declines their own assignment (separate from the
-- installer's install_acceptance_status). They only get the install checklist
-- once they have accepted.

alter table public.quotes
  add column if not exists electrician_acceptance_status text
    check (electrician_acceptance_status in ('pending', 'accepted', 'rejected'));

-- Anyone already assigned before this migration starts out pending.
update public.quotes
  set electrician_acceptance_status = 'pending'
  where electrician_id is not null and electrician_acceptance_status is null;
