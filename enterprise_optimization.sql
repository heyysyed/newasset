-- ============================================================
-- ASSETPRO ENTERPRISE OPTIMIZATION MIGRATION
-- Run this in Supabase SQL Editor to apply Phase 1 & 3 & 7 updates
-- ============================================================

-- ── 1. INDEXING FOR PERFORMANCE ───────────────────────────
-- Assets
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_site ON public.assets(site);
CREATE INDEX IF NOT EXISTS idx_assets_added_on ON public.assets(added_on);

-- Maintenance
CREATE INDEX IF NOT EXISTS idx_maint_tickets_status ON public.maintenance_tickets(status);
CREATE INDEX IF NOT EXISTS idx_maint_tickets_priority ON public.maintenance_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_maint_tickets_asset_id ON public.maintenance_tickets(asset_id);

-- Audits
CREATE INDEX IF NOT EXISTS idx_audit_items_session_id ON public.audit_items(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_items_asset_id ON public.audit_items(asset_id);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);

-- ── 2. PREVENTATIVE MAINTENANCE (PM) SCHEDULES ────────────
CREATE TABLE IF NOT EXISTS public.pm_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  next_due_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pm_schedules_asset_id ON public.pm_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_pm_schedules_next_due ON public.pm_schedules(next_due_date);

-- Enable Realtime for PM Schedules
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_schedules; EXCEPTION WHEN others THEN NULL; END $$;

-- ── 3. STOCK TRANSFERS (MULTI-SITE INVENTORY) ─────────────
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_no TEXT UNIQUE NOT NULL,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  from_site TEXT NOT NULL,
  to_site TEXT NOT NULL,
  quantity NUMERIC(15,3) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'received', 'cancelled')),
  requested_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_item_id ON public.stock_transfers(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.stock_transfers(status);

-- Enable Realtime for Stock Transfers
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_transfers; EXCEPTION WHEN others THEN NULL; END $$;
