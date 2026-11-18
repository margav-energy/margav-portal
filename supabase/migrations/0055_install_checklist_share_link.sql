-- Shareable install-checklist link (like the survey's /survey/[token]):
-- the office copies or launches /checklist/<access_token> so an installer or
-- electrician can add photos without logging in. The token is unguessable.
--
-- Photos also remember which role added them, because a link upload has no
-- signed-in user: an electrician may only remove photos an electrician added.
--
-- Safe to re-run.

alter table public.solar_install_checklists
  add column if not exists access_token text not null unique default encode(gen_random_bytes(24), 'hex');

alter table public.solar_install_checklist_photos
  add column if not exists uploaded_role text check (uploaded_role in ('installer', 'electrician'));
