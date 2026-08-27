-- `quotes.amount` (the "Value" column on the Quotes list) is a stored
-- column that only `src/components/quotes/actions.ts`'s new
-- `syncQuoteAmount` keeps in sync going forward, whenever a boiler
-- unit/solar array/extra is added, edited, or removed. Every quote built
-- out before that fix shipped is still sitting on whatever `amount` was at
-- creation (0 for an appointment-linked quote) — this one-off backfill
-- recomputes it the same way `syncQuoteAmount` does: each boiler unit's
-- price plus its own items, each solar array's items, and every
-- extra/standard-additional/free-text line item, all summed per quote.
--
-- Deliberately scoped to quotes that already have at least one boiler
-- unit, solar array, or line item — a still-empty "quick create" quote
-- keeps whatever estimate a rep manually typed in, same as
-- `syncQuoteAmount` (which only ever runs once there's something to sum).
--
-- Safe to re-run.

with unit_totals as (
  select bu.quote_id, sum(bu.price + coalesce(items.total, 0)) as total
  from public.boiler_units bu
  left join lateral (
    select sum((item ->> 'quantity')::numeric * (item ->> 'unitPrice')::numeric) as total
    from jsonb_array_elements(bu.items) as item
  ) as items on true
  group by bu.quote_id
),
array_totals as (
  select sa.quote_id, sum(coalesce(items.total, 0)) as total
  from public.solar_arrays sa
  left join lateral (
    select sum((item ->> 'quantity')::numeric * (item ->> 'unitPrice')::numeric) as total
    from jsonb_array_elements(sa.items) as item
  ) as items on true
  group by sa.quote_id
),
line_item_totals as (
  select quote_id, sum(quantity * unit_price) as total
  from public.quote_line_items
  group by quote_id
)
update public.quotes q
set amount = coalesce(ut.total, 0) + coalesce(at.total, 0) + coalesce(lit.total, 0)
from public.quotes qq
left join unit_totals ut on ut.quote_id = qq.id
left join array_totals at on at.quote_id = qq.id
left join line_item_totals lit on lit.quote_id = qq.id
where qq.id = q.id
  and (ut.quote_id is not null or at.quote_id is not null or lit.quote_id is not null);
