-- Link a solar quote to its Easy PV (Pro) project, plus a cached summary of
-- the design (panels / inverter / battery / roofs / BOM) pulled from the
-- Easy PV Open API by the "Refresh from Easy PV" button. See
-- src/data/easypv-service.ts. Design images and the proposal PDF are fetched
-- on demand and stored separately (not in this migration).
--
-- Safe to re-run.

alter table public.quotes
  add column if not exists easypv_project_id bigint,
  add column if not exists easypv_summary jsonb,
  add column if not exists easypv_synced_at timestamptz;

create index if not exists idx_quotes_easypv_project on public.quotes (easypv_project_id)
  where easypv_project_id is not null;
