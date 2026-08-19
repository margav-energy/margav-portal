-- Adds a dedicated nullable `sent_at` column to `quotes`, used by the
-- "Send Quote" action button on the quote detail page.
--
-- This is intentionally separate from `sent_date` (the date the quote was
-- originally issued/quoted) since `sent_at` records the timestamp of the
-- most recent in-app "Send Quote" click. There is no email provider wired
-- up yet — the `sendQuote` Server Action (see
-- `src/components/quotes/actions.ts`) just stamps this column and logs the
-- action. Swapping in a real email/SMS provider later should update this
-- same column on successful send.
--
-- Safe to re-run.

alter table public.quotes
  add column if not exists sent_at timestamptz;
