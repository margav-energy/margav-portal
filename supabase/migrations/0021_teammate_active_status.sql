-- Backs the deactivate/reactivate icon on Settings → Team Members (see
-- `setTeammateActiveAction`, src/app/settings/users/actions.ts). Deliberately
-- a soft flag rather than deleting the auth user or profile row outright:
-- `profiles.id` is referenced (with no cascade) from quotes.representative_id
-- /installer_id/rep_id, activity_feed.actor_id, quote_documents.uploaded_by,
-- and others (supabase/schema.sql) — a departed teammate's name still needs
-- to render correctly on that historical data.
--
-- Enforced at sign-in (`signInAction`, src/lib/auth-actions.ts) and on every
-- subsequent request (`getCurrentUser`, src/data/current-user.ts), which
-- signs the session back out the moment `active` is false — not just a
-- client-side hide.
--
-- Safe to re-run.

alter table public.profiles add column if not exists active boolean not null default true;
