-- Electricians: a field role that adds photos to the same solar install
-- checklist as the installer (electrical items only — enforced in the app).

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'rep', 'installer', 'electrician'));

alter table public.quotes
  add column if not exists electrician_id uuid references public.profiles (id) on delete set null;

create index if not exists quotes_electrician_id_idx on public.quotes (electrician_id);
