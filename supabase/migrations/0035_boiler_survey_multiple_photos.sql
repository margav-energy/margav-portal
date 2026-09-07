-- Allows more than one photo per checklist item on a boiler survey (see
-- `PhotoItemGroup` in src/app/survey/[token]/SurveyForm.tsx) — a surveyor
-- may want extra angles/close-ups beyond the one shot 0007_boiler_surveys.sql
-- originally assumed per item. The `unique (survey_id, item_key)` constraint
-- from that migration enforced exactly one row per item; drop it and keep a
-- plain index instead so lookups by (survey_id, item_key) stay fast.
--
-- Safe to re-run.

alter table public.boiler_survey_photos drop constraint if exists boiler_survey_photos_survey_id_item_key_key;

create index if not exists idx_boiler_survey_photos_survey_item on public.boiler_survey_photos (survey_id, item_key);
