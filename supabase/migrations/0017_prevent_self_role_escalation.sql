-- `profiles_update_own` (schema.sql) lets a user update their own profile
-- row for legitimate self-service edits, but it has no column restriction —
-- so nothing stops a user from calling
-- `supabase.from('profiles').update({ role: 'admin' }).eq('id', auth.uid())`
-- directly and escalating their own role, completely bypassing
-- `updateUserRoleAction`'s admin-only check (src/app/settings/users/actions.ts).
--
-- RLS USING/WITH CHECK clauses can't cleanly compare a row's before/after
-- values in one expression, so this is enforced with a trigger instead: any
-- attempt to change `role` where the acting user isn't an admin is rejected
-- outright, regardless of which policy let the UPDATE through.
--
-- `auth.uid()` is null when there's no end-user JWT on the request — i.e.
-- the service_role key (see src/lib/supabase/service.ts, which already
-- documents service_role as fully bypassing RLS). That path is exempted
-- rather than blocked: it's how `createUserAction` sets a brand-new
-- teammate's role server-side right after creating their auth user, with
-- no admin session in play yet.
--
-- Safe to re-run.

create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    if not exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    ) then
      raise exception 'Only admins can change a profile''s role';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_role_escalation on public.profiles;
create trigger profiles_prevent_self_role_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_self_role_escalation();
