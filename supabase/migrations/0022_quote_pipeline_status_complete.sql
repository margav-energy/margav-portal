-- Adds a 4th, final stage to `quotes.pipeline_status` — 'complete' — and
-- makes the whole column admin-editable for the first time (see
-- `updateQuotePipelineStatusAction`, src/components/quotes/actions.ts).
-- Previously this column was only ever set once at creation time
-- ('new_lead' — src/components/quotes/actions.ts createQuote/
-- createQuoteForAppointment) and never changed again.
--
-- Safe to re-run.

alter table public.quotes drop constraint if exists quotes_pipeline_status_check;
alter table public.quotes add constraint quotes_pipeline_status_check
  check (pipeline_status in ('new_lead', 'ready_to_pitch', 'locked', 'complete'));
