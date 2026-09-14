-- Lets a user archive an entry out of their own "Your recent activity" panel
-- (the clock icon next to the notification bell, src/components/layout/
-- RecentActivityBell.tsx) without touching the shared, admin-facing
-- Activity Feed (src/app/activity-feed/page.tsx), which still reads every
-- row regardless of this column — `activities` is a single shared audit
-- log, but each row has exactly one actor, so "archive" here is
-- unambiguously that actor's own call, same as `quotes.archived_at`
-- elsewhere in this schema.
alter table public.activities add column if not exists archived_at timestamptz;

-- Speeds up RecentActivityBell's `actor_id = ? and archived_at is[/not] null` query.
create index if not exists idx_activities_actor_archived on public.activities (actor_id, archived_at);
