-- `profiles` has always had a restrictive update policy (`profiles_update_own`,
-- schema.sql) — a row's owner can update it, nobody else. That's correct for
-- a self-service profile edit, but it silently blocks
-- `updateUserRoleAction` (src/app/settings/users/actions.ts): an admin
-- changing a TEAMMATE's role updates 0 rows under RLS, and the follow-up
-- `.select().single()` throws PGRST116 ("0 rows").
--
-- Adds a second, additive policy: an admin can update any profile. Multiple
-- permissive policies on the same table are OR'd by Postgres RLS, so this
-- doesn't take anything away from `profiles_update_own` — a non-admin still
-- can't touch anyone else's row. The self-referencing subquery (checking
-- the caller's own `role` via `profiles`) is safe, not recursive: it's
-- gated by `profiles_select_all` (schema.sql), which is unconditionally
-- `true` for any authenticated user.
--
-- Safe to re-run.

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (true);
