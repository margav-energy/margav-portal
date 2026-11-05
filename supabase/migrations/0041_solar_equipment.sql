-- Solar quote equipment sections: optimisers, inverters, batteries, EV chargers
-- and gateway / change-over switches. Each row is one entry (like a solar array):
-- a main product plus its accessory lines, held in `items` as line items.
-- Safe to re-run.

create table if not exists public.solar_equipment (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  kind text not null check (kind in ('optimiser', 'inverter', 'battery', 'ev_charger', 'gateway')),
  label text not null default '',
  items jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists solar_equipment_quote_id_idx on public.solar_equipment (quote_id);

alter table public.solar_equipment enable row level security;
drop policy if exists "solar_equipment_all_authenticated" on public.solar_equipment;
create policy "solar_equipment_all_authenticated" on public.solar_equipment
  for all to authenticated using (true) with check (true);
