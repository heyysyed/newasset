-- ============================================================
-- SQL SETUP: Add Unit Price / Rates to Bulk Items & Site Stock
-- Run this in Supabase SQL Editor if columns do not exist yet.
-- ============================================================

-- 1. Add unit_price column to bulk_items catalog table
ALTER TABLE public.bulk_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC DEFAULT 0;

-- 2. Add unit_price column override to bulk_site_stock table
ALTER TABLE public.bulk_site_stock ADD COLUMN IF NOT EXISTS unit_price NUMERIC DEFAULT 0;

-- 3. Update existing records with default zero if null
UPDATE public.bulk_items SET unit_price = 0 WHERE unit_price IS NULL;
UPDATE public.bulk_site_stock SET unit_price = 0 WHERE unit_price IS NULL;
