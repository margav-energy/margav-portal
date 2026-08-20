-- Mirrors 0003_notifications_unique_announcement.sql for the new
-- NotificationBanner announcement title shipped in this release (see
-- src/components/layout/NotificationBanner.tsx). The banner does the same
-- "insert if not exists" check-then-insert, so it needs its own partial
-- unique index once the title text changes — the old index only protects
-- the literal string 'Product update', not this one.
--
-- Safe to re-run.

create unique index if not exists idx_notifications_unique_release_announcement_202608
  on public.notifications (user_id, title)
  where title = 'Product update — August 2026';
