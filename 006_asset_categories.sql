-- 1. Create table
CREATE TABLE IF NOT EXISTS public.asset_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert defaults
INSERT INTO public.asset_categories (name) VALUES 
  ('Plant & Machinery'),
  ('Tools & Equipment'),
  ('Vehicles'),
  ('Electronics'),
  ('Safety Equipment'),
  ('Scaffolding'),
  ('IT'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

-- 3. RLS
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_read" ON public.asset_categories;
DROP POLICY IF EXISTS "categories_admin" ON public.asset_categories;

CREATE POLICY "categories_read" ON public.asset_categories FOR SELECT USING (auth.role() = 'authenticated');
-- Allow all authenticated users to manage for now, or just admins? We'll let application logic enforce admin via UI for now.
-- But wait, standard is admin check. We'll just check for role in profiles.
CREATE POLICY "categories_admin" ON public.asset_categories FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 4. Renaming Function
CREATE OR REPLACE FUNCTION rename_asset_category(p_old_name TEXT, p_new_name TEXT)
RETURNS void AS $$
BEGIN
  -- Update category in the master table
  UPDATE public.asset_categories SET name = p_new_name WHERE name = p_old_name;
  
  -- Cascade to assets
  UPDATE public.assets SET category = p_new_name WHERE category = p_old_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
