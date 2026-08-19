-- ── PHASE 3: PROCUREMENT & VENDOR MANAGEMENT (P2P) SETUP ──

-- 1. Vendors Table
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_code TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  gstin TEXT,
  pan_number TEXT,
  payment_terms TEXT DEFAULT 'Net 30',
  performance_score NUMERIC(3, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Purchase Requests (PR) Table
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_code TEXT NOT NULL,
  pr_number TEXT NOT NULL UNIQUE,
  department_id TEXT,
  requested_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'draft', -- draft, pending_manager, pending_finance, approved, rejected, ordered
  justification TEXT,
  total_estimated_cost NUMERIC(15, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Purchase Orders (PO) Table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_code TEXT NOT NULL,
  po_number TEXT NOT NULL UNIQUE,
  pr_id UUID REFERENCES public.purchase_requests(id),
  vendor_id UUID REFERENCES public.vendors(id),
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, partially_received, fulfilled, cancelled
  subtotal NUMERIC(15, 2) DEFAULT 0.00,
  cgst NUMERIC(15, 2) DEFAULT 0.00,
  sgst NUMERIC(15, 2) DEFAULT 0.00,
  igst NUMERIC(15, 2) DEFAULT 0.00,
  total NUMERIC(15, 2) DEFAULT 0.00,
  expected_delivery_date DATE,
  issued_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Purchase Order Items Table
CREATE TABLE IF NOT EXISTS public.po_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  unit_price NUMERIC(15, 2) NOT NULL,
  cgst_rate NUMERIC(5, 2) DEFAULT 0.00,
  sgst_rate NUMERIC(5, 2) DEFAULT 0.00,
  igst_rate NUMERIC(5, 2) DEFAULT 0.00,
  item_type TEXT NOT NULL, -- 'asset' or 'inventory'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Goods Receipts (GRN) Table
CREATE TABLE IF NOT EXISTS public.goods_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_code TEXT NOT NULL,
  po_id UUID REFERENCES public.purchase_orders(id),
  grn_number TEXT NOT NULL UNIQUE,
  received_by UUID REFERENCES public.profiles(id),
  received_date TIMESTAMPTZ DEFAULT NOW(),
  delivery_note_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies (Allow all authenticated users for now, relying on app-level logic)
CREATE POLICY "vendors_all" ON public.vendors FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "purchase_requests_all" ON public.purchase_requests FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "purchase_orders_all" ON public.purchase_orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "po_items_all" ON public.po_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "goods_receipts_all" ON public.goods_receipts FOR ALL USING (auth.role() = 'authenticated');

-- 8. Add to Realtime Publication
DO $$ 
BEGIN 
  ALTER PUBLICATION supabase_realtime ADD TABLE public.vendors; 
  ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_requests;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.goods_receipts;
EXCEPTION 
  WHEN others THEN NULL; 
END $$;
