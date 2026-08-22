-- ============================================================
-- AUDIT & MAINTENANCE MODULE — DATABASE MIGRATION
-- Run this in Supabase SQL Editor AFTER the main setup script
-- ============================================================

-- ── 1. SITES TABLE (GPS coordinates for geo-verification) ────
CREATE TABLE IF NOT EXISTS public.sites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  radius_meters INTEGER DEFAULT 200,
  address TEXT,
  checker_id UUID REFERENCES public.profiles(id),
  hod_id UUID REFERENCES public.profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. AUDIT ASSIGNMENTS (Admin assigns audits) ──────────────
CREATE TABLE IF NOT EXISTS public.audit_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  audit_type TEXT NOT NULL CHECK (audit_type IN ('asset_count', 'maintenance_checklist')),
  site_id UUID REFERENCES public.sites(id),
  assigned_to UUID REFERENCES public.profiles(id),
  assigned_by UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date DATE,
  notes TEXT,
  -- Completion fields (asset count)
  selfie_url TEXT,
  completion_latitude NUMERIC(10,7),
  completion_longitude NUMERIC(10,7),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. AUDIT ASSIGNMENT ITEMS (per-asset in asset count) ─────
CREATE TABLE IF NOT EXISTS public.audit_assignment_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES public.audit_assignments(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scanned', 'verified', 'unverified')),
  condition TEXT CHECK (condition IN ('operational', 'damaged', 'needs_repair', 'non_functional', 'missing')),
  condition_notes TEXT,
  scanned_at TIMESTAMPTZ,
  scan_latitude NUMERIC(10,7),
  scan_longitude NUMERIC(10,7),
  geo_verified BOOLEAN DEFAULT false,
  scanned_by UUID REFERENCES public.profiles(id),
  UNIQUE(assignment_id, asset_id)
);

-- ── 4. MAINTENANCE CHECKLISTS (templates imported from Excel) ─
CREATE TABLE IF NOT EXISTS public.maintenance_checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  items JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. MAINTENANCE CHECKLIST ↔ ASSET LINKS ───────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_checklist_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID REFERENCES public.maintenance_checklists(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  UNIQUE(checklist_id, asset_id)
);

-- ── 6. MAINTENANCE AUDIT SUBMISSIONS (completed audits + approvals) ─
CREATE TABLE IF NOT EXISTS public.maintenance_audit_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES public.audit_assignments(id) ON DELETE SET NULL,
  checklist_id UUID REFERENCES public.maintenance_checklists(id),
  asset_id UUID REFERENCES public.assets(id),
  results JSONB DEFAULT '[]',
  notes TEXT,
  -- Submission metadata
  submitted_by UUID REFERENCES public.profiles(id),
  submission_latitude NUMERIC(10,7),
  submission_longitude NUMERIC(10,7),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  -- 3-tier approval workflow
  approval_status TEXT DEFAULT 'pending_checker'
    CHECK (approval_status IN ('pending_checker', 'pending_hod', 'approved', 'rejected')),
  -- Tier 1: Prepared By (Auditor)
  prepared_by UUID REFERENCES public.profiles(id),
  prepared_signature TEXT,
  prepared_name TEXT,
  prepared_at TIMESTAMPTZ,
  -- Tier 2: Checked By (Site Supervisor / Checker)
  checker_id UUID REFERENCES public.profiles(id),
  checker_signature TEXT,
  checker_name TEXT,
  checker_notes TEXT,
  checked_at TIMESTAMPTZ,
  -- Tier 3: HOD (Head of Department)
  hod_id UUID REFERENCES public.profiles(id),
  hod_signature TEXT,
  hod_name TEXT,
  hod_notes TEXT,
  approved_at TIMESTAMPTZ,
  -- Generated PDF
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.sites                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_assignments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_assignment_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_checklists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_checklist_assets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_audit_submissions   ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Sites: everyone can read, admins/mods can manage
DROP POLICY IF EXISTS "sites_read"       ON public.sites;
DROP POLICY IF EXISTS "sites_admin"      ON public.sites;
CREATE POLICY "sites_read"   ON public.sites FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sites_admin"  ON public.sites FOR ALL    USING (public.is_moderator());

-- Audit assignments: authenticated can read their own, admins can manage all
DROP POLICY IF EXISTS "audit_assign_read"   ON public.audit_assignments;
DROP POLICY IF EXISTS "audit_assign_write"  ON public.audit_assignments;
CREATE POLICY "audit_assign_read"  ON public.audit_assignments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "audit_assign_write" ON public.audit_assignments FOR ALL    USING (auth.role() = 'authenticated');

-- Audit assignment items
DROP POLICY IF EXISTS "audit_assign_items_auth" ON public.audit_assignment_items;
CREATE POLICY "audit_assign_items_auth" ON public.audit_assignment_items FOR ALL USING (auth.role() = 'authenticated');

-- Maintenance checklists: everyone reads, admins manage
DROP POLICY IF EXISTS "maint_cl_read"  ON public.maintenance_checklists;
DROP POLICY IF EXISTS "maint_cl_admin" ON public.maintenance_checklists;
CREATE POLICY "maint_cl_read"  ON public.maintenance_checklists FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "maint_cl_admin" ON public.maintenance_checklists FOR ALL    USING (auth.role() = 'authenticated');

-- Maintenance checklist ↔ asset links
DROP POLICY IF EXISTS "maint_cl_assets_auth" ON public.maintenance_checklist_assets;
CREATE POLICY "maint_cl_assets_auth" ON public.maintenance_checklist_assets FOR ALL USING (auth.role() = 'authenticated');

-- Maintenance audit submissions
DROP POLICY IF EXISTS "maint_sub_auth" ON public.maintenance_audit_submissions;
CREATE POLICY "maint_sub_auth" ON public.maintenance_audit_submissions FOR ALL USING (auth.role() = 'authenticated');


-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto updated_at for new tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sites', 'audit_assignments', 'maintenance_checklists', 'maintenance_audit_submissions'
  ] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS %I ON public.%I;
      CREATE TRIGGER %I BEFORE UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    ', t||'_updated_at', t, t||'_updated_at', t);
  END LOOP;
END $$;


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sites_name                    ON public.sites(name);
CREATE INDEX IF NOT EXISTS idx_audit_assignments_site        ON public.audit_assignments(site_id);
CREATE INDEX IF NOT EXISTS idx_audit_assignments_assigned_to ON public.audit_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_audit_assignments_status      ON public.audit_assignments(status);
CREATE INDEX IF NOT EXISTS idx_audit_assignments_type        ON public.audit_assignments(audit_type);
CREATE INDEX IF NOT EXISTS idx_audit_assign_items_assignment ON public.audit_assignment_items(assignment_id);
CREATE INDEX IF NOT EXISTS idx_audit_assign_items_asset      ON public.audit_assignment_items(asset_id);
CREATE INDEX IF NOT EXISTS idx_maint_cl_category             ON public.maintenance_checklists(category);
CREATE INDEX IF NOT EXISTS idx_maint_cl_frequency            ON public.maintenance_checklists(frequency);
CREATE INDEX IF NOT EXISTS idx_maint_cl_assets_checklist     ON public.maintenance_checklist_assets(checklist_id);
CREATE INDEX IF NOT EXISTS idx_maint_cl_assets_asset         ON public.maintenance_checklist_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_maint_sub_assignment          ON public.maintenance_audit_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_maint_sub_checklist           ON public.maintenance_audit_submissions(checklist_id);
CREATE INDEX IF NOT EXISTS idx_maint_sub_asset               ON public.maintenance_audit_submissions(asset_id);
CREATE INDEX IF NOT EXISTS idx_maint_sub_approval            ON public.maintenance_audit_submissions(approval_status);
CREATE INDEX IF NOT EXISTS idx_maint_sub_submitted           ON public.maintenance_audit_submissions(submitted_at);


-- ============================================================
-- REALTIME
-- ============================================================

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_assignments;            EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_audit_submissions; EXCEPTION WHEN others THEN NULL; END $$;
