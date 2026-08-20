-- Admin-editable boiler install cost figures — powers the Profit card's
-- cost price for boiler quotes (see src/lib/boiler-install-cost.ts and
-- src/app/settings/boiler-costs). Previously hardcoded; moved here so a
-- supplier price change doesn't need a code deploy.
--
-- Singleton table (id is always `true`) — there is exactly one cost model
-- for the whole business, not one per quote or per rep. `unit_costs_by_kw`
-- is a jsonb map (e.g. {"24": 771.50, "30": 834.00, "36": 928.00}) rather
-- than fixed columns so an admin can add a new boiler size without a
-- migration; every other cost here is flat regardless of boiler size.
--
-- RLS here is permissive read/write for any signed-in user, matching every
-- other table in this schema — admin-only writes are gated in the Server
-- Action instead (src/app/settings/boiler-costs/actions.ts), not here.
--
-- Safe to re-run.

create table if not exists public.boiler_cost_settings (
  id boolean primary key default true,
  unit_costs_by_kw jsonb not null default '{}'::jsonb,
  fernox_system_filter numeric not null default 0,
  gateway_comfort_touch numeric not null default 0,
  installer_cost numeric not null default 0,
  cost_per_sale numeric not null default 0,
  commission numeric not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  constraint boiler_cost_settings_singleton check (id)
);

insert into public.boiler_cost_settings
  (id, unit_costs_by_kw, fernox_system_filter, gateway_comfort_touch, installer_cost, cost_per_sale, commission)
values (
  true,
  '{"24": 771.50, "30": 834.00, "36": 928.00}'::jsonb,
  52.00,
  134.50,
  700.00,
  300.00,
  300.00
)
on conflict (id) do nothing;

alter table public.boiler_cost_settings enable row level security;

drop policy if exists "boiler_cost_settings_all_authenticated" on public.boiler_cost_settings;
create policy "boiler_cost_settings_all_authenticated" on public.boiler_cost_settings
  for all to authenticated using (true) with check (true);
