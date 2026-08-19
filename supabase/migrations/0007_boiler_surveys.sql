-- Pre-installation survey for boiler quotes (the "Survey" action button on
-- BoilerQuoteDetail — see src/components/quotes/detail/build-action-buttons.ts).
--
-- Flow: a rep clicks "Survey" on a boiler quote → we create (or reuse) one
-- `boiler_surveys` row for that quote and show a QR code / "Launch form"
-- link built from its `access_token`. The on-site surveyor opens that link
-- — no portal login — fills in the form (mirrors
-- Boiler_Installation_Survey_Form.pdf) and submits, optionally attaching a
-- photo per checklist item. The quote detail page then shows a read-only
-- "Survey" card with the answers + photos.
--
-- One survey per quote (the `unique` on quote_id) — running "Survey" again
-- reopens the same record for editing rather than creating a second one.
--
-- Security note: because the whole point of `access_token` is that holding
-- the link is sufficient to fill in the form, these two tables get NO anon
-- RLS policy — unlike every other table in this schema, `using (true)` for
-- anon would let anyone with the public anon key dump every customer's
-- survey data, not just the one they hold a link for. Instead, the public
-- `/survey/[token]` route reads/writes through a service-role client
-- (`src/lib/supabase/service.ts`, the first use of that key in this app)
-- that bypasses RLS entirely, with every query hand-filtered by token in
-- application code. Portal staff still read/write normally (authenticated
-- policy below), same as every other table.
--
-- Storage: create a *private* bucket named exactly `boiler-survey-photos`
-- via Supabase Dashboard → Storage → New bucket (can't be done from SQL —
-- same limitation noted in 0005_presenter_decks.sql). Public-flow uploads
-- go through the service-role client (bypasses storage RLS too); the
-- policy below only grants portal staff read/write access to view them.
--
-- Safe to re-run.

create table if not exists public.boiler_surveys (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes (id) on delete cascade,
  access_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'submitted')),

  -- Property & Access
  property_type text,
  property_age text,
  occupancy text,
  landlord_permission_confirmed text,
  access_notes text,
  is_hmo text,

  -- Current Heating System
  current_boiler_make_model text,
  current_boiler_age text,
  current_boiler_type text,
  current_fuel_type text,
  known_faults text,
  current_boiler_location text,
  current_boiler_working text,

  -- New Installation Requirements
  desired_boiler_location text,
  reason_for_replacement text,
  bedrooms integer,
  bathrooms integer,
  radiators integer,
  occupants integer,
  simultaneous_hot_water_demand text,
  planned_extension text,

  -- Gas & Flue
  existing_gas_supply text,
  gas_meter_size text,
  current_flue_termination text,
  flue_route_obstructions text,

  -- Water & Pressure
  mains_water_pressure text,
  existing_cold_water_tank text,
  low_pressure_hard_water_history text,
  scale_reducer_required text,

  -- Electrics & Controls
  fused_spur_present text,
  smart_controls_requested text,

  -- Other Considerations
  asbestos_concerns text,
  responsible_person_signoff text,
  additional_notes text,

  -- Surveyor sign-off
  surveyor_name text,
  survey_date date,

  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boiler_survey_photos (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.boiler_surveys (id) on delete cascade,
  item_key text not null check (item_key in (
    'current_boiler_full',
    'current_boiler_badge',
    'boiler_location_wide',
    'flue_internal',
    'flue_external',
    'gas_meter',
    'gas_pipework_run',
    'mains_stopcock',
    'visible_pipework',
    'existing_cylinder',
    'loft_tank',
    'radiators_general',
    'proposed_location_wide',
    'electrical_supply_point',
    'obstructions_hazards'
  )),
  storage_path text not null,
  uploaded_at timestamptz not null default now(),
  unique (survey_id, item_key)
);

create index if not exists idx_boiler_surveys_quote on public.boiler_surveys (quote_id);
create index if not exists idx_boiler_survey_photos_survey on public.boiler_survey_photos (survey_id);

alter table public.boiler_surveys enable row level security;
alter table public.boiler_survey_photos enable row level security;

drop policy if exists "boiler_surveys_all_authenticated" on public.boiler_surveys;
create policy "boiler_surveys_all_authenticated" on public.boiler_surveys
  for all to authenticated using (true) with check (true);

drop policy if exists "boiler_survey_photos_all_authenticated" on public.boiler_survey_photos;
create policy "boiler_survey_photos_all_authenticated" on public.boiler_survey_photos
  for all to authenticated using (true) with check (true);

-- Storage access for portal staff viewing uploaded survey photos. Requires
-- the `boiler-survey-photos` bucket to already exist (see note above).
drop policy if exists "boiler_survey_photos_bucket_all_authenticated" on storage.objects;
create policy "boiler_survey_photos_bucket_all_authenticated"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'boiler-survey-photos')
  with check (bucket_id = 'boiler-survey-photos');
