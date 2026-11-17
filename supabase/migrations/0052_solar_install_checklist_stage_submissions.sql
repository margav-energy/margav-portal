-- Solar install photo checklist: the installer now sends each stage (pre /
-- mid / post) to the office separately. `submitted_stages` maps a stage to
-- { at, by } for each stage that's currently submitted; editing a photo or
-- N/A in a stage removes that stage from the map so it has to be re-sent.
-- `status` / `submitted_at` stay, meaning "all stages submitted" / latest.
--
-- Safe to re-run.

alter table public.solar_install_checklists
  add column if not exists submitted_stages jsonb not null default '{}'::jsonb;

-- Checklists already submitted as a whole count as all three stages sent.
update public.solar_install_checklists
set submitted_stages = jsonb_build_object(
  'pre', jsonb_build_object('at', submitted_at, 'by', submitted_by),
  'mid', jsonb_build_object('at', submitted_at, 'by', submitted_by),
  'post', jsonb_build_object('at', submitted_at, 'by', submitted_by)
)
where status = 'submitted' and submitted_stages = '{}'::jsonb;
