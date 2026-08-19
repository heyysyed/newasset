-- ── TOOL CRIB SETUP SCRIPT ──

-- 1. Create Tool Transactions Table
CREATE TABLE IF NOT EXISTS public.tool_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id),
  issued_by UUID REFERENCES public.profiles(id),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expected_return_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  received_by UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'checked_out' CHECK (status IN ('checked_out', 'returned', 'lost', 'damaged')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add Tool Status to Assets if not already present, or use the existing 'status' field.
-- We'll assume the standard `assets.status` field handles 'Checked Out', 'Active', 'Under Repair', etc.

-- 3. Enable RLS
ALTER TABLE public.tool_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tool_transactions_select" ON public.tool_transactions;
CREATE POLICY "tool_transactions_select" ON public.tool_transactions FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "tool_transactions_all" ON public.tool_transactions;
CREATE POLICY "tool_transactions_all" ON public.tool_transactions FOR ALL USING (public.is_moderator());

-- 4. Enable Realtime Replication
DO $$ 
BEGIN 
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tool_transactions; 
EXCEPTION 
  WHEN others THEN NULL; 
END $$;

-- 5. Attach Automatic updated_at Timestamp Trigger
DROP TRIGGER IF EXISTS tool_transactions_updated_at ON public.tool_transactions;
CREATE TRIGGER tool_transactions_updated_at BEFORE UPDATE ON public.tool_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_tool_trans_asset ON public.tool_transactions(asset_id);
CREATE INDEX IF NOT EXISTS idx_tool_trans_employee ON public.tool_transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_tool_trans_status ON public.tool_transactions(status);
