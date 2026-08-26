-- Margav Portal — full schema
--
-- Run this once in your Supabase project's SQL editor (Project → SQL Editor → New query).
-- Safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS.
--
-- After running this:
--   1. Go to Authentication → Users → Add user to create your first login (invite-only —
--      there is no public sign-up page in the app).
--   2. Copy Project URL / anon key / service_role key into .env.local (see .env.local.example).

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- profiles — one row per auth.users row, holds portal-specific fields.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  initials text not null default '',
  role text not null default 'rep' check (role in ('admin', 'rep', 'installer')),
  -- Self-service, same as full_name — shown in "Get In Touch" on the quote
  -- document (see supabase/migrations/0020_*.sql).
  phone text,
  -- Deactivate/reactivate on Settings → Team Members, see
  -- supabase/migrations/0021_teammate_active_status.sql.
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  derived_name text;
begin
  derived_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));
  insert into public.profiles (id, full_name, initials)
  values (
    new.id,
    derived_name,
    upper(left(derived_name, 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- quotes + everything hanging off a quote's detail page
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  reference text,
  version integer not null default 1,
  status_label text,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  customer_address_lines text[] not null default '{}',
  postcode text not null default '',
  address text not null default '',
  amount numeric(12, 2) not null default 0,
  -- The "System Summary" figures on the quote document that need a human
  -- to enter them rather than being derived from line items (see
  -- supabase/migrations/0020_*.sql). vat_amount is informational only —
  -- this business quotes VAT-inclusive prices, so it's never added on top.
  vat_amount numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  deposit_amount numeric(12, 2) not null default 0,
  payment_type text not null default 'cash' check (payment_type in ('cash', 'finance', 'card', 'bacs')),
  selected_payment_method text check (
    selected_payment_method in (
      'bacs', 'monthly_plan_15yr', 'interest_free_credit_3yr', 'hometree_25yr', 'buy_now_pay_later'
    )
  ),
  stage text not null default 'sent_to_sign' check (stage in ('sent_to_sign', 'signed')),
  sent_date date not null default current_date,
  signed_date date,
  install_status text check (
    install_status in (
      'awaiting_scaffold', 'scaffold_removal', 'install_in_progress', 'completed_install', 'cancelled'
    )
  ),
  notes text,
  product_type text not null default 'solar' check (product_type in ('solar', 'boiler')),
  -- Admin-editable lead lifecycle, see
  -- supabase/migrations/0022_quote_pipeline_status_complete.sql.
  pipeline_status text not null default 'new_lead' check (pipeline_status in ('new_lead', 'ready_to_pitch', 'locked', 'complete')),
  representative_id uuid references public.profiles (id),
  installer_id uuid references public.profiles (id),
  install_date date,
  install_acceptance_status text check (install_acceptance_status in ('pending', 'accepted', 'rejected')),
  is_favourite boolean not null default false,
  is_locked boolean not null default false,
  archived_at timestamptz,
  property_details jsonb not null default '{}'::jsonb,
  key_details jsonb not null default '{}'::jsonb,
  profit_breakdown jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boiler_units (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  label text not null default '',
  make text not null default '',
  model text not null default '',
  output_kw numeric(6, 2) not null default 0,
  fuel_type text not null default 'Mains Gas' check (fuel_type in ('Mains Gas', 'LPG', 'Oil')),
  flue_type text not null default 'Horizontal' check (flue_type in ('Horizontal', 'Vertical')),
  install_type text not null default 'Combi' check (install_type in ('Combi', 'System', 'Open Vent')),
  cylinder_litres numeric(8, 2),
  warranty_years integer not null default 0,
  items jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.solar_arrays (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  label text not null default '',
  shade_factor numeric(4, 3) not null default 1,
  orientation text not null default '',
  pitch_degrees numeric(5, 2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  section text not null check (section in ('extra', 'standard_additional', 'free_text')),
  name text,
  description text,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_notes (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  author_id uuid references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_history (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  is_system boolean not null default false,
  description text not null,
  created_at timestamptz not null default now()
);

-- An admin/rep-uploaded file attached to a quote (e.g. a filled-in boiler
-- quote PDF prepared outside the portal, a scanned signed copy, ...) — see
-- supabase/migrations/0019_quote_documents.sql. The private
-- `quote-documents` Storage bucket is self-provisioned on first upload
-- (src/app/quotes/[id]/documents-actions.ts), no manual dashboard step.
create table if not exists public.quote_documents (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  uploaded_by uuid references public.profiles (id),
  uploaded_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- appointments — one consolidated lifecycle table backing every
-- Appointments sub-page (unallocated / allocated / ready-to-confirm /
-- outcome-missing / RTA due / recently cancelled) and the calendar.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  email text,
  postcode text not null default '',
  address text not null default '',
  occupancy text,
  source text,
  medium text,
  term text,
  product_type text not null default 'solar' check (product_type in ('solar', 'boiler')),
  notes text,
  rep_id uuid references public.profiles (id),
  appointment_date date not null default current_date,
  start_time time not null default '09:00',
  end_time time,
  lifecycle_stage text not null default 'unallocated' check (
    lifecycle_stage in ('unallocated', 'allocated', 'ready_to_confirm', 'confirmed', 'completed', 'cancelled')
  ),
  calendar_stage text check (
    calendar_stage in ('allocated', 'booked', 'confirmed', 'not_pitched', 'pitch_and_miss', 'sold')
  ),
  acceptance_status text check (acceptance_status in ('pending', 'overdue', 'accepted', 'declined')),
  acceptance_response text,
  confirmation_status text check (confirmation_status in ('awaiting', 'confirmed', 'declined')),
  outcome text,
  outcome_logged_at timestamptz,
  cancellation_reason text,
  cancelled_at timestamptz,
  rta_due_date date,
  rebooked_from_id uuid references public.appointments (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- holidays
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references public.profiles (id),
  postcodes text[] not null default '{}',
  start_date date not null,
  end_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- installer_availability — self-reported day-by-day availability for the
-- 'installer' role, read-only reference for admins doing manual job
-- scheduling. Row presence (not just `status`) is meaningful: no row for a
-- date means "hasn't told us yet"; see 0014_installer_availability.sql.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.installer_availability (
  id uuid primary key default gen_random_uuid(),
  installer_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  status text not null check (status in ('available', 'unavailable')),
  note text,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (installer_id, date)
);

-- ─────────────────────────────────────────────────────────────────────────
-- activities — real audit log backing the Activity Feed page. Every
-- mutation in the app should insert one row here.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  is_system boolean not null default false,
  customer_name text not null default '',
  description text not null,
  status text not null default 'allocated' check (
    status in ('allocated', 'unallocated', 'ready_to_confirm', 'outcome_missing', 'cancelled')
  ),
  entity_type text,
  entity_id text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- notifications — backs the bell dropdown + per-user banner dismissal.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- indexes
-- ─────────────────────────────────────────────────────────────────────────

create index if not exists idx_quotes_stage on public.quotes (stage);
create index if not exists idx_quotes_pipeline_status on public.quotes (pipeline_status);
create index if not exists idx_quotes_installer_install_date on public.quotes (installer_id, install_date);
create index if not exists idx_boiler_units_quote on public.boiler_units (quote_id);
create index if not exists idx_solar_arrays_quote on public.solar_arrays (quote_id);
create index if not exists idx_quote_line_items_quote on public.quote_line_items (quote_id);
create index if not exists idx_quote_notes_quote on public.quote_notes (quote_id);
create index if not exists idx_quote_history_quote on public.quote_history (quote_id);
create index if not exists idx_quote_documents_quote on public.quote_documents (quote_id, uploaded_at desc);
create index if not exists idx_appointments_lifecycle on public.appointments (lifecycle_stage);
create index if not exists idx_appointments_date on public.appointments (appointment_date);
create index if not exists idx_holidays_status on public.holidays (status);
create index if not exists idx_installer_availability_date on public.installer_availability (date);
create index if not exists idx_installer_availability_installer on public.installer_availability (installer_id, date);
create index if not exists idx_activities_created_at on public.activities (created_at desc);
create index if not exists idx_notifications_user on public.notifications (user_id, is_read);

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — internal shared-workspace tool: any signed-in
-- teammate can read/write every business table. `profiles.role` is kept
-- for future role-gated policies but isn't enforced yet.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.quotes enable row level security;
alter table public.boiler_units enable row level security;
alter table public.solar_arrays enable row level security;
alter table public.quote_line_items enable row level security;
alter table public.quote_notes enable row level security;
alter table public.quote_history enable row level security;
alter table public.quote_documents enable row level security;
alter table public.appointments enable row level security;
alter table public.calendar_saved_views enable row level security;
alter table public.holidays enable row level security;
alter table public.installer_availability enable row level security;
alter table public.activities enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Additive to profiles_update_own (multiple permissive policies are OR'd by
-- Postgres RLS) — lets an admin update any teammate's profile, e.g. to
-- change their role from the settings page.
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (true);

-- Defense in depth: profiles_update_own has no column restriction, so on
-- its own it would let a user change their *own* role via a direct
-- Supabase call, bypassing the admin-only role-management UI entirely.
-- RLS USING/WITH CHECK can't cleanly compare before/after values in one
-- expression, so this is enforced with a trigger instead. `auth.uid()` is
-- null when the request carries no end-user JWT (the service_role key,
-- which already fully bypasses RLS elsewhere — see
-- src/lib/supabase/service.ts) — that path is exempted, since
-- `createUserAction` sets a new teammate's role that way right after
-- creating their auth user, before any admin session is involved.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    if not exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    ) then
      raise exception 'Only admins can change a profile''s role';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_role_escalation on public.profiles;
create trigger profiles_prevent_self_role_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_self_role_escalation();

-- Generic "any authenticated teammate can do anything" policy, applied to
-- every remaining business table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'quotes', 'boiler_units', 'solar_arrays', 'quote_line_items', 'quote_notes',
    'quote_history', 'quote_documents', 'appointments', 'calendar_saved_views', 'holidays',
    'installer_availability', 'activities', 'notifications'
  ]
  loop
    execute format('drop policy if exists "%1$s_all_authenticated" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_all_authenticated" on public.%1$s for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- Storage access for the `quote-documents` bucket (see quote_documents
-- above) — this policy applies as soon as the bucket exists, whether it
-- was self-provisioned (the normal path — see the table comment above) or
-- created manually.
drop policy if exists "quote_documents_bucket_all_authenticated" on storage.objects;
create policy "quote_documents_bucket_all_authenticated"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'quote-documents')
  with check (bucket_id = 'quote-documents');
