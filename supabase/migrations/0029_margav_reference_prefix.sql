-- Changes the quote reference prefix from "Q-" (0028_quote_reference_numbers.sql)
-- to "MarGav-" — same sequence, same numbers, just the brand prefix
-- requested instead of a generic one. Existing "Q-####" references are
-- rewritten to "MarGav-####" so they stay consistent with new ones.
--
-- Safe to re-run.

create or replace function public.set_quote_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null then
    new.reference := 'MarGav-' || nextval('public.quotes_reference_seq');
  end if;
  return new;
end;
$$;

update public.quotes
set reference = 'MarGav-' || substring(reference from '^Q-(\d+)$')
where reference ~ '^Q-\d+$';
