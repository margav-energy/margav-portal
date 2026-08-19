-- Prevents duplicate rows for the NotificationBanner's per-user
-- "Product update" announcement (see src/components/layout/NotificationBanner.tsx)
-- when it does its "insert if not exists" check-then-insert from two
-- concurrent requests/tabs.
--
-- Scoped to just that one well-known title via a partial index, so regular
-- notifications (e.g. "Holiday request approved") are still free to repeat
-- for the same user without hitting a uniqueness conflict.
--
-- Safe to re-run.

create unique index if not exists idx_notifications_unique_announcement
  on public.notifications (user_id, title)
  where title = 'Product update';
