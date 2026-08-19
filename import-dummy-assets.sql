-- Run this in your Supabase SQL Editor to insert 200 dummy assets

-- First, clear out any dummy assets from previous failed attempts
DELETE FROM public.assets WHERE asset_code LIKE '%/DUMMY/%';

INSERT INTO public.assets (
  asset_code, 
  asset_name, 
  make, 
  model_no, 
  category, 
  site, 
  status, 
  purchase_value, 
  purchase_date,
  useful_life_years,
  depreciation_method,
  depreciation_rate_percent,
  company_code,
  notes
)
SELECT 
  'SBC/DUMMY/' || LPAD(i::text, 4, '0'),
  'Dummy Asset ' || i,
  CASE 
    WHEN i % 5 = 0 THEN 'Caterpillar' 
    WHEN i % 5 = 1 THEN 'Toyota' 
    WHEN i % 5 = 2 THEN 'Dell' 
    WHEN i % 5 = 3 THEN 'JCB'
    ELSE 'Herman Miller' 
  END as make,
  'MDL-' || (1000 + (i % 50)) as model_no,
  CASE 
    WHEN i % 6 = 0 THEN 'Plant & Machinery' 
    WHEN i % 6 = 1 THEN 'Vehicles' 
    WHEN i % 6 = 2 THEN 'IT' 
    WHEN i % 6 = 3 THEN 'Safety Equipment' 
    WHEN i % 6 = 4 THEN 'Tools & Equipment' 
    ELSE 'Other' 
  END as category,
  CASE 
    WHEN i % 3 = 0 THEN 'Project Site A' 
    WHEN i % 3 = 1 THEN 'Project Site B' 
    ELSE 'Head Office' 
  END as site,
  CASE 
    WHEN i % 10 = 0 THEN 'Under Repair'
    WHEN i % 15 = 0 THEN 'Disposed'
    ELSE 'Active'
  END as status,
  (random() * 50000 + 1000)::numeric(15,2) as purchase_value,
  CURRENT_DATE - (random() * 365 * 5)::integer as purchase_date,
  CASE WHEN i % 2 = 0 THEN 5 ELSE 10 END as useful_life_years,
  'Straight Line' as depreciation_method,
  CASE WHEN i % 2 = 0 THEN 20.00 ELSE 10.00 END as depreciation_rate_percent,
  'SBC' as company_code,
  'Dummy Data' as notes
FROM generate_series(1, 1200) as i;
