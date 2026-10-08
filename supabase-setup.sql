-- ============================================================
-- SKYWAY GROUP — ASSET MANAGEMENT SYSTEM — FULL DATABASE SETUP
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Supports: Asset Management, Audit Checklists, Procurement,
--           Maintenance, Inventory/Consumables, Asset Tracking,
--           Utility Monitoring, Gate Passes, Notifications,
--           Activity Logs, Roles & Permissions
-- ============================================================

-- ── 1. USER PROFILES & ROLES ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin','moderator','user')),
  department TEXT,
  phone TEXT,
  photo_url TEXT,
  signature_url TEXT,
  is_active BOOLEAN DEFAULT true,
  custom_permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. APP SETTINGS (admin-controlled) ────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hidden_fields TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '[]',
  sticker_config JSONB DEFAULT '{}',
  moderator_permissions JSONB DEFAULT '{
    "can_add": true,
    "can_edit_location": true,
    "can_edit_status": true,
    "can_edit_all": false,
    "can_delete": false,
    "can_print_stickers": true,
    "can_export": true,
    "can_import": false,
    "visible_fields": []
  }',
  user_permissions JSONB DEFAULT '{
    "visible_fields": []
  }',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ── 3. CHECKLIST TEMPLATES (created before assets for FK) ──
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  asset_type TEXT,
  items JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. ASSETS TABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_code TEXT UNIQUE NOT NULL,
  asset_name TEXT,
  make TEXT,
  model_no TEXT,
  purchase_order_no TEXT,
  serial_no TEXT,
  capacity TEXT,
  status TEXT DEFAULT 'Active',
  category TEXT,
  site TEXT,
  type_code TEXT,
  purchase_date DATE,
  location TEXT,
  department TEXT,
  assigned_to UUID REFERENCES public.profiles(id),
  notes TEXT,
  custom_fields JSONB DEFAULT '{}',
  -- Financial & Depreciation
  purchase_value NUMERIC(15,2),
  salvage_value NUMERIC(15,2),
  useful_life_years INTEGER DEFAULT 5,
  depreciation_method TEXT DEFAULT 'Straight Line' CHECK (depreciation_method IN ('Straight Line','Reducing Balance')),
  depreciation_rate_percent NUMERIC(5,2),
  -- Geo-location
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  -- Lifecycle
  warranty_expiry DATE,
  disposal_date DATE,
  disposal_reason TEXT,
  -- Checklist link
  checklist_template_id UUID REFERENCES public.checklist_templates(id),
  -- Quantity
  quantity INTEGER DEFAULT 1,
  -- Parent-Child hierarchy
  parent_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  added_on TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES public.profiles(id)
);

-- ── 5. DELETED ASSETS (Trash / Soft-delete Archive) ───────
CREATE TABLE IF NOT EXISTS public.deleted_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_id UUID,
  asset_code TEXT,
  asset_name TEXT,
  make TEXT,
  model_no TEXT,
  purchase_order_no TEXT,
  serial_no TEXT,
  capacity TEXT,
  status TEXT,
  category TEXT,
  site TEXT,
  type_code TEXT,
  purchase_date DATE,
  location TEXT,
  department TEXT,
  assigned_to UUID,
  notes TEXT,
  custom_fields JSONB DEFAULT '{}',
  purchase_value NUMERIC(15,2),
  salvage_value NUMERIC(15,2),
  useful_life_years INTEGER,
  depreciation_method TEXT,
  depreciation_rate_percent NUMERIC(5,2),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  warranty_expiry DATE,
  disposal_date DATE,
  disposal_reason TEXT,
  checklist_template_id UUID,
  added_on TIMESTAMPTZ,
  added_by UUID,
  deleted_by UUID REFERENCES public.profiles(id),
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  delete_reason TEXT
);

-- ── 6. ASSET PHOTOS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.asset_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. ASSET ATTACHMENTS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.asset_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. ASSET CHANGE LOG (system audit trail) ──────────────
CREATE TABLE IF NOT EXISTS public.asset_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  action TEXT,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. ASSET MOVEMENTS (check-in / check-out / transfers) ─
CREATE TABLE IF NOT EXISTS public.asset_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  moved_by UUID REFERENCES public.profiles(id),
  movement_type TEXT CHECK (movement_type IN ('check_out','check_in','transfer','maintenance_out','maintenance_in')),
  from_location TEXT,
  to_location TEXT,
  from_assignee UUID REFERENCES public.profiles(id),
  to_assignee UUID REFERENCES public.profiles(id),
  notes TEXT,
  moved_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. ACTIVITY LOGS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  entity_name TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 11. PHYSICAL AUDIT SESSIONS & ITEMS ───────────────────
CREATE TABLE IF NOT EXISTS public.audit_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  filter_type TEXT CHECK (filter_type IN ('location','category','project','site','all')),
  filter_value TEXT,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.audit_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.audit_sessions(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  result TEXT DEFAULT 'unverified' CHECK (result IN ('unverified','verified','missing')),
  notes TEXT,
  photo_urls JSONB DEFAULT '[]',
  checked_by UUID REFERENCES public.profiles(id),
  checked_at TIMESTAMPTZ,
  UNIQUE(session_id, asset_id)
);

-- ── 12. AUDIT SCHEDULES (Recurring Audits) ────────────────
CREATE TABLE IF NOT EXISTS public.audit_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  filter_type TEXT CHECK (filter_type IN ('location','category','project','site','all')),
  filter_value TEXT,
  frequency TEXT CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly')),
  next_due DATE,
  last_run DATE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 13. VENDORS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  category TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 14. PURCHASE REQUISITIONS ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_requisitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  asset_description TEXT,
  quantity INTEGER DEFAULT 1,
  estimated_cost NUMERIC(15,2),
  category TEXT,
  location TEXT,
  requested_by UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','ordered','delivered')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  approved_by UUID REFERENCES public.profiles(id),
  approval_notes TEXT,
  required_by DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 15. PURCHASE ORDERS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id),
  requisition_id UUID REFERENCES public.purchase_requisitions(id),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','partially_received','closed','cancelled')),
  delivery_location TEXT,
  delivery_date DATE,
  total_amount NUMERIC(15,2),
  tax_percent NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.po_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  received_quantity INTEGER DEFAULT 0,
  unit_price NUMERIC(15,2),
  asset_id UUID REFERENCES public.assets(id)
);

-- ── 16. MAINTENANCE TICKETS (Corrective) ──────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_no TEXT UNIQUE NOT NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  ticket_type TEXT CHECK (ticket_type IN ('breakdown','fault','damage','inspection','scheduled','other')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','assigned','working','in_progress','resolved','closed','cancelled')),
  reported_by UUID REFERENCES public.profiles(id),
  assigned_to UUID REFERENCES public.profiles(id),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  downtime_start TIMESTAMPTZ,
  downtime_end TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ,
  source_schedule_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1001;

-- ── 17. MAINTENANCE SCHEDULES (Preventive) ────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly','one_time')),
  next_due DATE,
  last_done DATE,
  assigned_to UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 18. MAINTENANCE LOGS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES public.maintenance_schedules(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.maintenance_tickets(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  performed_by UUID REFERENCES public.profiles(id),
  work_done TEXT,
  parts_used TEXT,
  cost NUMERIC(15,2),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  next_due DATE
);

-- ── 19. MAINTENANCE PHOTOS ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  log_id UUID REFERENCES public.maintenance_logs(id) ON DELETE SET NULL,
  photo_url TEXT NOT NULL,
  photo_type TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 20. TICKET COMMENTS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 21. INVENTORY (CONSUMABLES & SPARES) ──────────────────
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code TEXT UNIQUE NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT,
  unit TEXT DEFAULT 'pcs',
  current_stock NUMERIC(15,3) DEFAULT 0,
  reorder_level NUMERIC(15,3) DEFAULT 0,
  unit_cost NUMERIC(15,2),
  location TEXT,
  location_bin TEXT,
  preferred_vendor_id UUID REFERENCES public.vendors(id),
  min_order_qty NUMERIC(15,3) DEFAULT 0,
  image_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 22. INVENTORY REQUESTS (Approval Workflow) ────────────
CREATE TABLE IF NOT EXISTS public.inventory_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES public.profiles(id),
  quantity NUMERIC(15,3) NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','issued')),
  approver_id UUID REFERENCES public.profiles(id),
  approval_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 23. INVENTORY TRANSACTIONS ────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  transaction_type TEXT CHECK (transaction_type IN ('receipt','issue','transfer','adjustment','adjustment_in','purchase','return')),
  quantity NUMERIC(15,3) NOT NULL,
  balance_after NUMERIC(15,3),
  from_location TEXT,
  to_location TEXT,
  reference TEXT,
  notes TEXT,
  performed_by UUID REFERENCES public.profiles(id),
  transaction_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 23.5 BULK ITEMS (SCAFFOLDING, PIPES, PLATES) ───────────
CREATE TABLE IF NOT EXISTS public.bulk_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code TEXT UNIQUE NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT,
  unit TEXT DEFAULT 'pcs',
  unit_weight_kg NUMERIC(15,3) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bulk_site_stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.bulk_items(id) ON DELETE CASCADE,
  site TEXT NOT NULL,
  usable_qty NUMERIC(15,3) DEFAULT 0,
  in_use_qty NUMERIC(15,3) DEFAULT 0,
  scrap_qty NUMERIC(15,3) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, site)
);

CREATE TABLE IF NOT EXISTS public.bulk_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.bulk_items(id) ON DELETE CASCADE,
  transaction_type TEXT CHECK (transaction_type IN ('receipt','transfer','deploy','dismantle','scrap','adjustment')),
  from_site TEXT,
  to_site TEXT,
  quantity NUMERIC(15,3) NOT NULL,
  total_weight_kg NUMERIC(15,3),
  reference TEXT,
  notes TEXT,
  performed_by UUID REFERENCES public.profiles(id),
  transaction_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 24. GATE PASSES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gate_passes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pass_no TEXT UNIQUE NOT NULL,
  pass_type TEXT CHECK (pass_type IN ('outgoing','incoming','returnable')),
  purpose TEXT,
  vehicle_no TEXT,
  driver_name TEXT,
  company_code TEXT DEFAULT 'SBC',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed','cancelled')),
  requested_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gate_pass_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gate_pass_id UUID REFERENCES public.gate_passes(id) ON DELETE CASCADE,
  item_type TEXT CHECK (item_type IN ('asset','inventory','other')),
  asset_id UUID REFERENCES public.assets(id),
  inventory_item_id UUID REFERENCES public.inventory_items(id),
  description TEXT,
  quantity NUMERIC(15,3) DEFAULT 1,
  unit TEXT DEFAULT 'pcs',
  remarks TEXT
);

-- ── 25. NOTIFICATIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 26. UTILITY READINGS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.utility_readings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  utility_type TEXT CHECK (utility_type IN ('electricity','water','gas','fuel','hours','other')),
  reading_value NUMERIC(15,3) NOT NULL,
  reading_unit TEXT,
  threshold_value NUMERIC(15,3),
  recorded_by UUID REFERENCES public.profiles(id),
  reading_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 27. CHECKLIST SUBMISSIONS ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.checklist_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  site TEXT,
  location TEXT,
  performed_by UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'pass' CHECK (status IN ('pass', 'fail', 'resolved')),
  results JSONB DEFAULT '[]',
  notes TEXT,
  signature_checked_by TEXT,
  inspector_verified_name TEXT,
  signature_incharge TEXT,
  incharge_verified_name TEXT,
  incharge_designation TEXT,
  verification_ref TEXT,
  physical_upload_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_assets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_photos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_attachments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_audit            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_schedules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requisitions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_photos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_site_stock        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_passes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_pass_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utility_readings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_submissions  ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- ROLE HELPER FUNCTIONS (Avoid Recursion in Policies)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','moderator'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Profiles
DROP POLICY IF EXISTS "profiles_select"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all"  ON public.profiles;
CREATE POLICY "profiles_select"       ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert"       ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"   ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all"    ON public.profiles FOR ALL USING (public.is_admin());

-- App settings
DROP POLICY IF EXISTS "settings_read"        ON public.app_settings;
DROP POLICY IF EXISTS "settings_admin_write" ON public.app_settings;
CREATE POLICY "settings_read"         ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_write"  ON public.app_settings FOR ALL USING (public.is_admin());

-- Assets
DROP POLICY IF EXISTS "assets_read_auth"    ON public.assets;
DROP POLICY IF EXISTS "assets_insert_auth"  ON public.assets;
DROP POLICY IF EXISTS "assets_update_auth"  ON public.assets;
DROP POLICY IF EXISTS "assets_delete_admin" ON public.assets;
CREATE POLICY "assets_read_auth"      ON public.assets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "assets_insert_auth"    ON public.assets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "assets_update_auth"    ON public.assets FOR UPDATE USING (public.is_moderator());
CREATE POLICY "assets_delete_admin"   ON public.assets FOR DELETE USING (public.is_admin());

-- Deleted assets
DROP POLICY IF EXISTS "deleted_assets_auth" ON public.deleted_assets;
CREATE POLICY "deleted_assets_auth"   ON public.deleted_assets FOR ALL USING (auth.role() = 'authenticated');

-- Asset photos
DROP POLICY IF EXISTS "asset_photos_auth" ON public.asset_photos;
CREATE POLICY "asset_photos_auth"     ON public.asset_photos FOR ALL USING (auth.role() = 'authenticated');

-- Asset attachments
DROP POLICY IF EXISTS "asset_attachments_auth" ON public.asset_attachments;
CREATE POLICY "asset_attachments_auth" ON public.asset_attachments FOR ALL USING (auth.role() = 'authenticated');

-- Asset audit log
DROP POLICY IF EXISTS "audit_read"   ON public.asset_audit;
DROP POLICY IF EXISTS "audit_insert" ON public.asset_audit;
CREATE POLICY "audit_read"           ON public.asset_audit FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "audit_insert"         ON public.asset_audit FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Asset movements
DROP POLICY IF EXISTS "movements_auth" ON public.asset_movements;
CREATE POLICY "movements_auth"        ON public.asset_movements FOR ALL USING (auth.role() = 'authenticated');

-- Activity logs
DROP POLICY IF EXISTS "activity_logs_auth" ON public.activity_logs;
CREATE POLICY "activity_logs_auth"    ON public.activity_logs FOR ALL USING (auth.role() = 'authenticated');

-- Audit sessions & items
DROP POLICY IF EXISTS "audit_sessions_auth" ON public.audit_sessions;
DROP POLICY IF EXISTS "audit_items_auth"    ON public.audit_items;
CREATE POLICY "audit_sessions_auth"   ON public.audit_sessions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "audit_items_auth"      ON public.audit_items FOR ALL USING (auth.role() = 'authenticated');

-- Audit schedules
DROP POLICY IF EXISTS "audit_schedules_auth" ON public.audit_schedules;
CREATE POLICY "audit_schedules_auth"  ON public.audit_schedules FOR ALL USING (auth.role() = 'authenticated');

-- Vendors
DROP POLICY IF EXISTS "vendors_read"        ON public.vendors;
DROP POLICY IF EXISTS "vendors_write_admin" ON public.vendors;
CREATE POLICY "vendors_read"          ON public.vendors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "vendors_write_admin"   ON public.vendors FOR ALL USING (public.is_moderator());

-- Procurement
DROP POLICY IF EXISTS "pr_auth"       ON public.purchase_requisitions;
DROP POLICY IF EXISTS "po_select" ON public.purchase_orders;
DROP POLICY IF EXISTS "po_insert" ON public.purchase_orders;
DROP POLICY IF EXISTS "po_update" ON public.purchase_orders;
DROP POLICY IF EXISTS "po_delete" ON public.purchase_orders;
DROP POLICY IF EXISTS "po_items_select" ON public.po_items;
DROP POLICY IF EXISTS "po_items_insert" ON public.po_items;
DROP POLICY IF EXISTS "po_items_update" ON public.po_items;
DROP POLICY IF EXISTS "po_items_delete" ON public.po_items;
CREATE POLICY "pr_auth"              ON public.purchase_requisitions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "po_select" ON public.purchase_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "po_insert" ON public.purchase_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "po_update" ON public.purchase_orders FOR UPDATE USING (public.is_moderator());
CREATE POLICY "po_delete" ON public.purchase_orders FOR DELETE USING (public.is_admin());
CREATE POLICY "po_items_select" ON public.po_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "po_items_insert" ON public.po_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "po_items_update" ON public.po_items FOR UPDATE USING (public.is_moderator());
CREATE POLICY "po_items_delete" ON public.po_items FOR DELETE USING (public.is_admin());

-- Maintenance
DROP POLICY IF EXISTS "tickets_select" ON public.maintenance_tickets;
DROP POLICY IF EXISTS "tickets_insert" ON public.maintenance_tickets;
DROP POLICY IF EXISTS "tickets_update" ON public.maintenance_tickets;
DROP POLICY IF EXISTS "tickets_delete" ON public.maintenance_tickets;
DROP POLICY IF EXISTS "maint_sched_select" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "maint_sched_insert" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "maint_sched_update" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "maint_sched_delete" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "maint_logs_select" ON public.maintenance_logs;
DROP POLICY IF EXISTS "maint_logs_insert" ON public.maintenance_logs;
DROP POLICY IF EXISTS "maint_logs_update" ON public.maintenance_logs;
DROP POLICY IF EXISTS "maint_logs_delete" ON public.maintenance_logs;
DROP POLICY IF EXISTS "maint_photos_select" ON public.maintenance_photos;
DROP POLICY IF EXISTS "maint_photos_insert" ON public.maintenance_photos;
DROP POLICY IF EXISTS "maint_photos_update" ON public.maintenance_photos;
DROP POLICY IF EXISTS "maint_photos_delete" ON public.maintenance_photos;
DROP POLICY IF EXISTS "ticket_comments_select" ON public.ticket_comments;
DROP POLICY IF EXISTS "ticket_comments_insert" ON public.ticket_comments;
DROP POLICY IF EXISTS "ticket_comments_update" ON public.ticket_comments;
DROP POLICY IF EXISTS "ticket_comments_delete" ON public.ticket_comments;
CREATE POLICY "tickets_select" ON public.maintenance_tickets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tickets_insert" ON public.maintenance_tickets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "tickets_update" ON public.maintenance_tickets FOR UPDATE USING (public.is_moderator());
CREATE POLICY "tickets_delete" ON public.maintenance_tickets FOR DELETE USING (public.is_admin());
CREATE POLICY "maint_sched_select" ON public.maintenance_schedules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "maint_sched_insert" ON public.maintenance_schedules FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "maint_sched_update" ON public.maintenance_schedules FOR UPDATE USING (public.is_moderator());
CREATE POLICY "maint_sched_delete" ON public.maintenance_schedules FOR DELETE USING (public.is_admin());
CREATE POLICY "maint_logs_select" ON public.maintenance_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "maint_logs_insert" ON public.maintenance_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "maint_logs_update" ON public.maintenance_logs FOR UPDATE USING (public.is_moderator());
CREATE POLICY "maint_logs_delete" ON public.maintenance_logs FOR DELETE USING (public.is_admin());
CREATE POLICY "maint_photos_select" ON public.maintenance_photos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "maint_photos_insert" ON public.maintenance_photos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "maint_photos_update" ON public.maintenance_photos FOR UPDATE USING (public.is_moderator());
CREATE POLICY "maint_photos_delete" ON public.maintenance_photos FOR DELETE USING (public.is_admin());
CREATE POLICY "ticket_comments_select" ON public.ticket_comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ticket_comments_insert" ON public.ticket_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "ticket_comments_update" ON public.ticket_comments FOR UPDATE USING (public.is_moderator());
CREATE POLICY "ticket_comments_delete" ON public.ticket_comments FOR DELETE USING (public.is_admin());

-- Inventory
DROP POLICY IF EXISTS "inv_items_select" ON public.inventory_items;
DROP POLICY IF EXISTS "inv_items_insert" ON public.inventory_items;
DROP POLICY IF EXISTS "inv_items_update" ON public.inventory_items;
DROP POLICY IF EXISTS "inv_items_delete" ON public.inventory_items;
DROP POLICY IF EXISTS "inv_tx_select" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inv_tx_insert" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inv_tx_update" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inv_tx_delete" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inv_req_select" ON public.inventory_requests;
DROP POLICY IF EXISTS "inv_req_insert" ON public.inventory_requests;
DROP POLICY IF EXISTS "inv_req_update" ON public.inventory_requests;
DROP POLICY IF EXISTS "inv_req_delete" ON public.inventory_requests;
CREATE POLICY "inv_items_select" ON public.inventory_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inv_items_insert" ON public.inventory_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "inv_items_update" ON public.inventory_items FOR UPDATE USING (public.is_moderator());
CREATE POLICY "inv_items_delete" ON public.inventory_items FOR DELETE USING (public.is_admin());
CREATE POLICY "inv_tx_select" ON public.inventory_transactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inv_tx_insert" ON public.inventory_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "inv_tx_update" ON public.inventory_transactions FOR UPDATE USING (public.is_moderator());
CREATE POLICY "inv_tx_delete" ON public.inventory_transactions FOR DELETE USING (public.is_admin());
CREATE POLICY "inv_req_select" ON public.inventory_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inv_req_insert" ON public.inventory_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "inv_req_update" ON public.inventory_requests FOR UPDATE USING (public.is_moderator());
CREATE POLICY "inv_req_delete" ON public.inventory_requests FOR DELETE USING (public.is_admin());

-- Bulk Items
DROP POLICY IF EXISTS "bulk_items_select" ON public.bulk_items;
DROP POLICY IF EXISTS "bulk_items_insert" ON public.bulk_items;
DROP POLICY IF EXISTS "bulk_items_update" ON public.bulk_items;
DROP POLICY IF EXISTS "bulk_items_delete" ON public.bulk_items;
DROP POLICY IF EXISTS "bulk_stock_select" ON public.bulk_site_stock;
DROP POLICY IF EXISTS "bulk_stock_insert" ON public.bulk_site_stock;
DROP POLICY IF EXISTS "bulk_stock_update" ON public.bulk_site_stock;
DROP POLICY IF EXISTS "bulk_stock_delete" ON public.bulk_site_stock;
DROP POLICY IF EXISTS "bulk_tx_select" ON public.bulk_transactions;
DROP POLICY IF EXISTS "bulk_tx_insert" ON public.bulk_transactions;
DROP POLICY IF EXISTS "bulk_tx_update" ON public.bulk_transactions;
DROP POLICY IF EXISTS "bulk_tx_delete" ON public.bulk_transactions;
CREATE POLICY "bulk_items_select" ON public.bulk_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "bulk_items_insert" ON public.bulk_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "bulk_items_update" ON public.bulk_items FOR UPDATE USING (public.is_moderator());
CREATE POLICY "bulk_items_delete" ON public.bulk_items FOR DELETE USING (public.is_admin());
CREATE POLICY "bulk_stock_select" ON public.bulk_site_stock FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "bulk_stock_insert" ON public.bulk_site_stock FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "bulk_stock_update" ON public.bulk_site_stock FOR UPDATE USING (public.is_moderator());
CREATE POLICY "bulk_stock_delete" ON public.bulk_site_stock FOR DELETE USING (public.is_admin());
CREATE POLICY "bulk_tx_select" ON public.bulk_transactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "bulk_tx_insert" ON public.bulk_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "bulk_tx_update" ON public.bulk_transactions FOR UPDATE USING (public.is_moderator());
CREATE POLICY "bulk_tx_delete" ON public.bulk_transactions FOR DELETE USING (public.is_admin());

-- Gate passes
DROP POLICY IF EXISTS "gate_passes_select" ON public.gate_passes;
DROP POLICY IF EXISTS "gate_passes_insert" ON public.gate_passes;
DROP POLICY IF EXISTS "gate_passes_update" ON public.gate_passes;
DROP POLICY IF EXISTS "gate_passes_delete" ON public.gate_passes;
DROP POLICY IF EXISTS "gate_pass_items_select" ON public.gate_pass_items;
DROP POLICY IF EXISTS "gate_pass_items_insert" ON public.gate_pass_items;
DROP POLICY IF EXISTS "gate_pass_items_update" ON public.gate_pass_items;
DROP POLICY IF EXISTS "gate_pass_items_delete" ON public.gate_pass_items;
CREATE POLICY "gate_passes_select" ON public.gate_passes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "gate_passes_insert" ON public.gate_passes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "gate_passes_update" ON public.gate_passes FOR UPDATE USING (public.is_moderator());
CREATE POLICY "gate_passes_delete" ON public.gate_passes FOR DELETE USING (public.is_admin());
CREATE POLICY "gate_pass_items_select" ON public.gate_pass_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "gate_pass_items_insert" ON public.gate_pass_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "gate_pass_items_update" ON public.gate_pass_items FOR UPDATE USING (public.is_moderator());
CREATE POLICY "gate_pass_items_delete" ON public.gate_pass_items FOR DELETE USING (public.is_admin());

-- Notifications
DROP POLICY IF EXISTS "notifications_auth" ON public.notifications;
CREATE POLICY "notifications_auth"    ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- Utility readings
DROP POLICY IF EXISTS "utility_auth" ON public.utility_readings;
CREATE POLICY "utility_auth"          ON public.utility_readings FOR ALL USING (auth.role() = 'authenticated');

-- Checklists
DROP POLICY IF EXISTS "checklist_templates_auth"   ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_admin"   ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_submissions_auth"  ON public.checklist_submissions;
CREATE POLICY "checklist_templates_auth"   ON public.checklist_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "checklist_templates_admin"  ON public.checklist_templates FOR ALL USING (public.is_moderator());
CREATE POLICY "checklist_submissions_auth" ON public.checklist_submissions FOR ALL USING (auth.role() = 'authenticated');


-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'assets','profiles','app_settings','vendors','purchase_requisitions',
    'purchase_orders','maintenance_tickets','inventory_items','inventory_requests',
    'audit_schedules','gate_passes','checklist_templates',
    'bulk_items','bulk_site_stock'
  ] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS %I ON public.%I;
      CREATE TRIGGER %I BEFORE UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    ', t||'_updated_at', t, t||'_updated_at', t);
  END LOOP;
END $$;

-- Inventory balance trigger
CREATE OR REPLACE FUNCTION public.update_inventory_balance()
RETURNS trigger AS $$
DECLARE
  v_old_stock NUMERIC;
  v_new_stock NUMERIC;
BEGIN
  SELECT current_stock INTO v_old_stock FROM public.inventory_items WHERE id = NEW.item_id FOR UPDATE;

  IF NEW.transaction_type IN ('receipt', 'return', 'adjustment_in', 'purchase') THEN
    v_new_stock := v_old_stock + NEW.quantity;
  ELSE
    v_new_stock := v_old_stock - NEW.quantity;
  END IF;

  UPDATE public.inventory_items SET current_stock = v_new_stock, updated_at = NOW() WHERE id = NEW.item_id;

  NEW.balance_after := v_new_stock;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_balance_trigger ON public.inventory_transactions;
CREATE TRIGGER inventory_balance_trigger
  BEFORE INSERT ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_inventory_balance();


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_assets_code              ON public.assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_assets_status            ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category          ON public.assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_location          ON public.assets(location);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to       ON public.assets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_profiles_role            ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_audit_items_session      ON public.audit_items(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_items_asset        ON public.audit_items(asset_id);
CREATE INDEX IF NOT EXISTS idx_movements_asset          ON public.asset_movements(asset_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity     ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user       ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_date       ON public.activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_maint_sched_asset        ON public.maintenance_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_maint_sched_due          ON public.maintenance_schedules(next_due);
CREATE INDEX IF NOT EXISTS idx_tickets_asset            ON public.maintenance_tickets(asset_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status           ON public.maintenance_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket   ON public.ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_maint_photos_ticket      ON public.maintenance_photos(ticket_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_item              ON public.inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_gate_passes_status       ON public.gate_passes(status);
CREATE INDEX IF NOT EXISTS idx_gate_pass_items_pass     ON public.gate_pass_items(gate_pass_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user       ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_utility_asset            ON public.utility_readings(asset_id);
CREATE INDEX IF NOT EXISTS idx_utility_date             ON public.utility_readings(reading_date);
CREATE INDEX IF NOT EXISTS idx_checklist_template       ON public.checklist_submissions(template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_asset          ON public.checklist_submissions(asset_id);
CREATE INDEX IF NOT EXISTS idx_checklist_date           ON public.checklist_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_asset_photos_asset       ON public.asset_photos(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_attachments_asset  ON public.asset_attachments(asset_id);
CREATE INDEX IF NOT EXISTS idx_deleted_assets_original  ON public.deleted_assets(original_id);


-- ============================================================
-- REALTIME
-- ============================================================

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.assets;              EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;             EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_sessions;       EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_tickets;  EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_submissions; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;        EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;      EXCEPTION WHEN others THEN NULL; END $$;


-- ============================================================
-- STORAGE BUCKET
-- ============================================================
-- Create this manually in Supabase Dashboard → Storage:
--   Bucket name: checklist-uploads
--   Public: YES (so uploaded images are accessible via public URL)
--
-- Then add this storage policy in SQL:
INSERT INTO storage.buckets (id, name, public) VALUES ('checklist-uploads', 'checklist-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
DROP POLICY IF EXISTS "storage_auth_upload" ON storage.objects;
CREATE POLICY "storage_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'checklist-uploads' AND auth.role() = 'authenticated');

-- Allow public read access
DROP POLICY IF EXISTS "storage_public_read" ON storage.objects;
CREATE POLICY "storage_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'checklist-uploads');

-- Allow authenticated users to update their uploads
DROP POLICY IF EXISTS "storage_auth_update" ON storage.objects;
CREATE POLICY "storage_auth_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'checklist-uploads' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their uploads
DROP POLICY IF EXISTS "storage_auth_delete" ON storage.objects;
CREATE POLICY "storage_auth_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'checklist-uploads' AND auth.role() = 'authenticated');


-- ============================================================
-- ADMIN BOOTSTRAP
-- ============================================================
-- After signing up your first account, make yourself admin:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';

-- ============================================================
-- ENTERPRISE OPTIMIZATION
-- ============================================================

-- ── INDEXING FOR PERFORMANCE ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_site ON public.assets(site);
CREATE INDEX IF NOT EXISTS idx_assets_added_on ON public.assets(added_on);
CREATE INDEX IF NOT EXISTS idx_maint_tickets_status ON public.maintenance_tickets(status);
CREATE INDEX IF NOT EXISTS idx_maint_tickets_priority ON public.maintenance_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_maint_tickets_asset_id ON public.maintenance_tickets(asset_id);
CREATE INDEX IF NOT EXISTS idx_audit_items_session_id ON public.audit_items(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_items_asset_id ON public.audit_items(asset_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);

-- ── 25. PREVENTATIVE MAINTENANCE (PM) SCHEDULES ───────────
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

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_schedules; EXCEPTION WHEN others THEN NULL; END $$;

-- ── 26. STOCK TRANSFERS (MULTI-SITE INVENTORY) ────────────
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

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_transfers; EXCEPTION WHEN others THEN NULL; END $$;

-- ============================================================
-- ── 27. AUTHORITATIVE CONCURRENCY-SAFE SHA-256 AUDIT TRIGGER
-- ============================================================
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS previous_hash TEXT DEFAULT '0000000000000000000000000000000000000000000000000000000000000000';
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS current_hash TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS sequence_number BIGSERIAL;

CREATE OR REPLACE FUNCTION fn_generate_audit_sha256_hash()
RETURNS TRIGGER AS $$
DECLARE
  v_prev_hash TEXT;
  v_canonical_payload TEXT;
BEGIN
  -- Transactional advisory lock to prevent race conditions during concurrent audit inserts
  PERFORM pg_advisory_xact_lock(4892019);

  -- Retrieve current_hash of previous audit record in strict sequence order
  SELECT current_hash INTO v_prev_hash
  FROM public.activity_logs
  WHERE sequence_number < NEW.sequence_number
  ORDER BY sequence_number DESC
  LIMIT 1;

  IF v_prev_hash IS NULL THEN
    v_prev_hash := '0000000000000000000000000000000000000000000000000000000000000000';
  END IF;

  NEW.previous_hash := v_prev_hash;
  v_canonical_payload := concat_ws(':', NEW.id::text, NEW.user_id::text, NEW.action, NEW.entity_type, NEW.entity_id::text, NEW.created_at::text, v_prev_hash);
  
  -- Compute cryptographic SHA-256 using pgcrypto
  NEW.current_hash := encode(digest(v_canonical_payload, 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_sha256_chain ON public.activity_logs;
CREATE TRIGGER trg_audit_sha256_chain
  BEFORE INSERT ON public.activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION fn_generate_audit_sha256_hash();

-- Prevent updating or deleting audit logs to enforce immutability
CREATE OR REPLACE FUNCTION fn_prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable. Update and delete operations are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON public.activity_logs;
CREATE TRIGGER trg_prevent_audit_update
  BEFORE UPDATE OR DELETE ON public.activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_audit_modification();

-- Server-side audit chain integrity verification RPC function
CREATE OR REPLACE FUNCTION fn_verify_audit_chain_integrity()
RETURNS TABLE (
  status TEXT,
  total_logs BIGINT,
  first_invalid_id UUID,
  expected_hash TEXT,
  actual_hash TEXT
) AS $$
DECLARE
  rec RECORD;
  v_prev TEXT := '0000000000000000000000000000000000000000000000000000000000000000';
  v_calc TEXT;
  v_count BIGINT := 0;
BEGIN
  FOR rec IN SELECT id, user_id, action, entity_type, entity_id, created_at, previous_hash, current_hash FROM public.activity_logs ORDER BY sequence_number ASC LOOP
    v_count := v_count + 1;
    v_calc := encode(digest(concat_ws(':', rec.id::text, rec.user_id::text, rec.action, rec.entity_type, rec.entity_id::text, rec.created_at::text, v_prev), 'sha256'), 'hex');
    
    IF rec.current_hash IS NOT NULL AND rec.current_hash <> v_calc THEN
      RETURN QUERY SELECT 'INTEGRITY_FAILURE'::text, v_count, rec.id, v_calc, rec.current_hash;
      RETURN;
    END IF;
    v_prev := rec.current_hash;
  END LOOP;

  RETURN QUERY SELECT 'VALID'::text, v_count, NULL::UUID, NULL::text, NULL::text;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ── 28. SCHEDULED REPORT ENGINES & JOB CLAIMING ──────────────
-- ============================================================
CREATE TABLE IF NOT EXISTS public.report_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL,
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'monthly', 'cron')),
  cron_expression TEXT,
  dimensions JSONB DEFAULT '[]',
  metrics JSONB DEFAULT '[]',
  recipients TEXT[] DEFAULT '{}',
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.report_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES public.report_schedules(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  rows_count INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactional job claim function using FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION fn_claim_report_schedule()
RETURNS TABLE (schedule_id UUID, template_name TEXT, webhook_url TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.template_name, s.webhook_url
  FROM public.report_schedules s
  WHERE s.is_active = true AND (s.updated_at < NOW() - INTERVAL '1 hour' OR s.updated_at IS NULL)
  ORDER BY s.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ── 29. SSRF-SAFE REGISTERED PRINTERS & PRINT QUEUE ──────────
-- ============================================================
CREATE TABLE IF NOT EXISTS public.registered_printers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  printer_name TEXT NOT NULL,
  location TEXT,
  trusted_ip TEXT NOT NULL,
  mac_address TEXT,
  model TEXT DEFAULT 'Zebra ZD420',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert sample default registered printer securely
INSERT INTO public.registered_printers (id, printer_name, location, trusted_ip, model)
VALUES ('00000000-0000-0000-0000-000000000001', 'Main Yard Zebra ZD420', 'Main Maintenance Yard', '192.168.1.150:9100', 'Zebra ZD420')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.print_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  printer_id UUID REFERENCES public.registered_printers(id) ON DELETE RESTRICT,
  template_name TEXT NOT NULL,
  zpl_payload TEXT NOT NULL,
  status TEXT DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PRINTING', 'COMPLETED', 'FAILED', 'RETRYING')),
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_id ON public.print_jobs(printer_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON public.print_jobs(status);

-- ============================================================
-- ── 30. OPTIMISTIC CONCURRENCY CONTROL VERSIONING ────────────
-- ============================================================
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS record_version INTEGER DEFAULT 1;

-- ============================================================
-- ── 31. HARDENED ROW LEVEL SECURITY (RLS) POLICIES ─────────
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registered_printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY profiles_select_policy ON public.profiles FOR SELECT USING (true);
CREATE POLICY profiles_update_policy ON public.profiles FOR UPDATE USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- Assets Policies
CREATE POLICY assets_select_policy ON public.assets FOR SELECT USING (true);
CREATE POLICY assets_insert_policy ON public.assets FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'moderator'))
);
CREATE POLICY assets_update_policy ON public.assets FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'moderator'))
);
CREATE POLICY assets_delete_policy ON public.assets FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- Registered Printers Policies
CREATE POLICY registered_printers_select ON public.registered_printers FOR SELECT USING (true);
CREATE POLICY print_jobs_select ON public.print_jobs FOR SELECT USING (true);
CREATE POLICY print_jobs_insert ON public.print_jobs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


