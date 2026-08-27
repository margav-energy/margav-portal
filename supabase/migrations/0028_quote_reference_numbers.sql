-- `quotes.reference` (see schema.sql) has always existed but nothing ever
-- actually set it — `referenceFor()` in src/data/quotes-mappers.ts falls
-- back to the raw UUID `id` whenever it's null, which is what's been
-- showing up everywhere a reference is displayed (the quote page heading,
-- emails, signed PDFs): long, and meaningless to read aloud or type.
--
-- This gives every quote a short, sequential, human-friendly reference
-- instead — "Q-1001", "Q-1002", ... — assigned automatically on insert
-- (via a trigger, so every insert path gets it for free, not just the app
-- code that exists today) and enforced unique at the database level.
--
-- Safe to re-run.

create sequence if not exists public.quotes_reference_seq start 1001;

create or replace function public.set_quote_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null then
    new.reference := 'Q-' || nextval('public.quotes_reference_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_set_reference on public.quotes;
create trigger quotes_set_reference
  before insert on public.quotes
  for each row
  execute function public.set_quote_reference();

-- Backfill every quote that predates this migration.
update public.quotes
set reference = 'Q-' || nextval('public.quotes_reference_seq')
where reference is null;

alter table public.quotes drop constraint if exists quotes_reference_key;
alter table public.quotes add constraint quotes_reference_key unique (reference);
