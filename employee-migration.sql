-- ── EMPLOYEE MANAGEMENT & ASSET RELATION SETUP ──
-- Paste and run this script in the Supabase SQL Editor (Dashboard → SQL Editor)

-- 1. Create Employees Table
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  designation TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS) & Policies
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_select" ON public.employees;
CREATE POLICY "employees_select" ON public.employees FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "employees_all_admin" ON public.employees;
CREATE POLICY "employees_all_admin" ON public.employees FOR ALL
  USING (public.is_moderator());

-- 3. Add Employee Link Column to Assets
ALTER TABLE public.assets 
  ADD COLUMN IF NOT EXISTS assigned_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- 4. Create Foreign Key Index
CREATE INDEX IF NOT EXISTS idx_assets_assigned_employee ON public.assets(assigned_employee_id);

-- 5. Enable Realtime Replication
DO $$ 
BEGIN 
  ALTER PUBLICATION supabase_realtime ADD TABLE public.employees; 
EXCEPTION 
  WHEN others THEN NULL; 
END $$;

-- 6. Attach Automatic updated_at Timestamp Trigger
DROP TRIGGER IF EXISTS employees_updated_at ON public.employees;
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
