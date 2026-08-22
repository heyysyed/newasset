-- Run this in your Supabase SQL Editor to insert 1000 dummy Bulk Inventory Items and their Stock

-- First, clear out any dummy bulk items from previous attempts
DELETE FROM public.bulk_items WHERE item_code LIKE 'BULK/DUMMY/%';

-- Use a CTE (Common Table Expression) to insert the items and their stock in one go
WITH inserted_items AS (
  INSERT INTO public.bulk_items (
    item_code, 
    item_name, 
    category, 
    unit, 
    unit_weight_kg, 
    notes
  )
  SELECT 
    'BULK/DUMMY/' || LPAD(i::text, 4, '0'),
    'Bulk Material ' || i,
    CASE 
      WHEN i % 4 = 0 THEN 'Scaffolding' 
      WHEN i % 4 = 1 THEN 'Consumables' 
      WHEN i % 4 = 2 THEN 'Pipes' 
      ELSE 'Plates' 
    END as category,
    CASE 
      WHEN i % 3 = 0 THEN 'nos' 
      WHEN i % 3 = 1 THEN 'kg' 
      ELSE 'meters' 
    END as unit,
    (random() * 50 + 1)::numeric(15,3) as unit_weight_kg,
    'Dummy Data' as notes
  FROM generate_series(1, 1000) as i
  RETURNING id
)
INSERT INTO public.bulk_site_stock (
  item_id, 
  site, 
  usable_qty, 
  in_use_qty, 
  scrap_qty
)
SELECT 
  items.id,
  sites.site,
  (random() * 500 + 10)::numeric(15,3) as usable_qty,
  (random() * 200)::numeric(15,3) as in_use_qty,
  (random() * 50)::numeric(15,3) as scrap_qty
FROM inserted_items items
CROSS JOIN (
  VALUES ('Main Warehouse'), ('Project Site A'), ('Project Site B')
) as sites(site);
