-- ── DOCUMENT & COMPLIANCE MANAGEMENT SETUP ──

-- 1. Create Asset Documents Table
CREATE TABLE IF NOT EXISTS public.asset_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'Insurance', 'Registration', 'Warranty', 'Manual', 'Other'
  document_number TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT,
  issue_date DATE,
  expiry_date DATE,
  alert_days_before INT DEFAULT 30,
  notes TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.asset_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_documents_select" ON public.asset_documents;
CREATE POLICY "asset_documents_select" ON public.asset_documents FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "asset_documents_all" ON public.asset_documents;
CREATE POLICY "asset_documents_all" ON public.asset_documents FOR ALL USING (public.is_moderator());

-- 3. Enable Realtime
DO $$ 
BEGIN 
  ALTER PUBLICATION supabase_realtime ADD TABLE public.asset_documents; 
EXCEPTION 
  WHEN others THEN NULL; 
END $$;

-- 4. Attach Automatic updated_at Trigger
DROP TRIGGER IF EXISTS asset_documents_updated_at ON public.asset_documents;
CREATE TRIGGER asset_documents_updated_at BEFORE UPDATE ON public.asset_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_asset_documents_asset_id ON public.asset_documents(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_documents_expiry ON public.asset_documents(expiry_date);
