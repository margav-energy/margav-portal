-- One-off: copy the Spark example quote onto Emmanuella's solar quote.
-- Run in the Supabase SQL editor AFTER migration 0040 (solar_arrays needs module_wp / module_count / orientation_degrees).
-- It REPLACES that quote's solar arrays, extras, standard additionals and free-text extras, and merges the
-- property details / key details. It stops without changing anything unless exactly one solar quote matches.
-- Not copied: Inverter, Battery, Solar Optimisers, EV Charger and Gateway — the portal has no sections for them.

do $$
declare
  qid uuid;
  matches integer;
  arr_id uuid;
begin
  select count(*) into matches
  from public.quotes
  where product_type = 'solar' and customer_name ilike 'emmanuella%';

  if matches <> 1 then
    raise exception 'Expected exactly 1 solar quote for "Emmanuella", found %', matches;
  end if;

  select id into qid
  from public.quotes
  where product_type = 'solar' and customer_name ilike 'emmanuella%';

  update public.quotes
  set
    property_details = coalesce(property_details, '{}'::jsonb) || jsonb_build_object(
      'occupancyArchetype', 'In most of the day',
      'annualConsumptionKwh', 8434,
      'electricUnitRate', 0.2467,
      'estimatedBill', 'Yes',
      'customEstimate', true,
      'estimatedReason', 'Customer has just added a high load item such as an EV, ASHP or Hot Tub',
      'tariffType', 'Standard',
      'sprayFoam', 'No',
      'mpan', 'Provided in Email'
    ),
    -- 28 x 485 W = 13.58 kWp; 2 x EcoFlow OCEAN 2 5 kWh batteries (10 kWh nominal — set the usable figure if it differs)
    key_details = coalesce(key_details, '{}'::jsonb) || jsonb_build_object(
      'panels', 28,
      'batteries', 2,
      'systemSizeKw', 13.58,
      'batteryUsableKwh', 10
    ),
    amount = 12401
  where id = qid;

  delete from public.solar_arrays where quote_id = qid;
  delete from public.quote_line_items where quote_id = qid;

  -- Array 1
  insert into public.solar_arrays (quote_id, label, shade_factor, orientation, orientation_degrees, pitch_degrees, module_wp, module_count, sort_order, items)
  values (qid, 'Solar Array #1', 0.94, '15° South', 15, 25, 485, 6, 0, '[
    {"id":"a1-1","name":"AIKO Neostar 3S 485w","quantity":6,"unitPrice":170},
    {"id":"a1-2","name":"Survey","quantity":1,"unitPrice":0},
    {"id":"a1-3","name":"Bird Barrier","quantity":30,"unitPrice":0},
    {"id":"a1-4","name":"Flashing","quantity":1,"unitPrice":0},
    {"id":"a1-5","name":"Hazard Labels (Solar)","quantity":1,"unitPrice":0},
    {"id":"a1-6","name":"Generation Meter","quantity":1,"unitPrice":0},
    {"id":"a1-7","name":"DC Switch Disconnector (Dual String)","quantity":2,"unitPrice":0},
    {"id":"a1-8","name":"Pre-Terminated Cable","quantity":4,"unitPrice":0},
    {"id":"a1-9","name":"Connector Kit","quantity":2,"unitPrice":0},
    {"id":"a1-10","name":"Cable (50m)","quantity":50,"unitPrice":0},
    {"id":"a1-11","name":"Scaffolding","quantity":1,"unitPrice":500},
    {"id":"a1-12","name":"MCS Certificate","quantity":1,"unitPrice":82},
    {"id":"a1-13","name":"EPVS Certification","quantity":1,"unitPrice":45},
    {"id":"a1-14","name":"10yr HIES Insurance Backed Guarantee","quantity":1,"unitPrice":89},
    {"id":"a1-15","name":"SAP Design","quantity":1,"unitPrice":100},
    {"id":"a1-16","name":"Installation","quantity":1,"unitPrice":1500}
  ]'::jsonb);

  -- Array 2
  insert into public.solar_arrays (quote_id, label, shade_factor, orientation, orientation_degrees, pitch_degrees, module_wp, module_count, sort_order, items)
  values (qid, 'Solar Array #2', 0.96, '15° South', 15, 35, 485, 6, 1, '[
    {"id":"a2-1","name":"AIKO Neostar 3S 485w","quantity":6,"unitPrice":170},
    {"id":"a2-2","name":"Bird Barrier","quantity":30,"unitPrice":0},
    {"id":"a2-3","name":"Flashing","quantity":1,"unitPrice":0},
    {"id":"a2-4","name":"Scaffolding","quantity":1,"unitPrice":500}
  ]'::jsonb);

  -- Array 3
  insert into public.solar_arrays (quote_id, label, shade_factor, orientation, orientation_degrees, pitch_degrees, module_wp, module_count, sort_order, items)
  values (qid, 'Solar Array #3', 1, '15° South', 15, 30, 485, 4, 2, '[
    {"id":"a3-1","name":"AIKO Neostar 3S 485w","quantity":4,"unitPrice":170},
    {"id":"a3-2","name":"Bird Barrier","quantity":30,"unitPrice":0},
    {"id":"a3-3","name":"Flashing","quantity":1,"unitPrice":0},
    {"id":"a3-4","name":"Scaffolding","quantity":1,"unitPrice":500}
  ]'::jsonb);

  -- Array 4
  insert into public.solar_arrays (quote_id, label, shade_factor, orientation, orientation_degrees, pitch_degrees, module_wp, module_count, sort_order, items)
  values (qid, 'Solar Array #4', 1, '105° South', 105, 35, 485, 12, 3, '[
    {"id":"a4-1","name":"AIKO Neostar 3S 485w","quantity":12,"unitPrice":170},
    {"id":"a4-2","name":"Bird Barrier","quantity":30,"unitPrice":0},
    {"id":"a4-3","name":"Flashing","quantity":1,"unitPrice":0},
    {"id":"a4-4","name":"Scaffolding","quantity":1,"unitPrice":500}
  ]'::jsonb);

  -- Extras (unit price = Spark's line total / quantity)
  insert into public.quote_line_items (quote_id, section, name, quantity, unit_price, sort_order) values
    (qid, 'extra', 'Extra Full Installation Day', 2, 1450, 0),
    (qid, 'extra', 'Extra Half Installation Day', 1, 725, 1),
    (qid, 'standard_additional', 'Additional items', 1, 200, 0);
end $$;
