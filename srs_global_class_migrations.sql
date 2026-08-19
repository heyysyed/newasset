-- SRS Global-Class Additive Schema Migration for AssetPro
-- 100% Safe & Self-Healing Migration (Creates missing tables automatically)

-- 1. Assets Table Enhancements
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_scrapped BOOLEAN DEFAULT FALSE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS pending_scrap BOOLEAN DEFAULT FALSE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS transfer_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS scrap_value NUMERIC(15,2) DEFAULT 0;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS scrap_reason TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS scrap_date TIMESTAMPTZ;

-- 2. Bulk Site Stock Enhancements
CREATE TABLE IF NOT EXISTS bulk_site_stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID,
  site TEXT NOT NULL,
  usable_qty NUMERIC(12,2) DEFAULT 0,
  in_use_qty NUMERIC(12,2) DEFAULT 0,
  scrap_qty NUMERIC(12,2) DEFAULT 0,
  in_transit_qty NUMERIC(12,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bulk_site_stock ADD COLUMN IF NOT EXISTS in_transit_qty NUMERIC(12,2) DEFAULT 0;

-- 3. Stock Transfers / Gate Passes Enhancements
CREATE TABLE IF NOT EXISTS bulk_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID,
  transaction_type TEXT NOT NULL,
  from_site TEXT,
  to_site TEXT,
  quantity NUMERIC(12,2) DEFAULT 0,
  total_weight_kg NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  performed_by UUID,
  e_signature_url TEXT,
  dispatched_by_name TEXT,
  received_by_name TEXT,
  transit_status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bulk_transactions ADD COLUMN IF NOT EXISTS e_signature_url TEXT;
ALTER TABLE bulk_transactions ADD COLUMN IF NOT EXISTS dispatched_by_name TEXT;
ALTER TABLE bulk_transactions ADD COLUMN IF NOT EXISTS received_by_name TEXT;
ALTER TABLE bulk_transactions ADD COLUMN IF NOT EXISTS transit_status TEXT DEFAULT 'completed';

-- 4. Bulk Audits Table (Create if not exists & Add columns)
CREATE TABLE IF NOT EXISTS bulk_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site TEXT NOT NULL,
  item_id UUID,
  system_qty NUMERIC(12,2) DEFAULT 0,
  physical_qty NUMERIC(12,2) DEFAULT 0,
  variance_qty NUMERIC(12,2) DEFAULT 0,
  is_high_risk_anomaly BOOLEAN DEFAULT FALSE,
  reasoning TEXT,
  audited_by UUID,
  frozen BOOLEAN DEFAULT TRUE,
  audited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bulk_audits ADD COLUMN IF NOT EXISTS variance_qty NUMERIC(12,2) DEFAULT 0;
ALTER TABLE bulk_audits ADD COLUMN IF NOT EXISTS is_high_risk_anomaly BOOLEAN DEFAULT FALSE;
ALTER TABLE bulk_audits ADD COLUMN IF NOT EXISTS frozen BOOLEAN DEFAULT TRUE;

-- 5. Offline Actions Backup Table
CREATE TABLE IF NOT EXISTS offline_action_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 5: Additive Schema Migration for Audit & Verification Command Center 2.0 ──

-- 1. Sites Geofencing Extensions
CREATE TABLE IF NOT EXISTS sites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  latitude NUMERIC(10,8),
  longitude NUMERIC(11,8),
  allowed_radius_meters NUMERIC(6,2) DEFAULT 150.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,8);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS longitude NUMERIC(11,8);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS allowed_radius_meters NUMERIC(6,2) DEFAULT 150.00;

-- 2. Audit Assignments Enhancements
CREATE TABLE IF NOT EXISTS audit_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  audit_type TEXT DEFAULT 'asset_count',
  site_id UUID,
  assigned_to UUID,
  status TEXT DEFAULT 'pending',
  due_date DATE,
  notes TEXT,
  blind_count BOOLEAN DEFAULT FALSE,
  is_blind_audit BOOLEAN DEFAULT FALSE,
  geofence_verified BOOLEAN DEFAULT FALSE,
  auditor_selfie_url TEXT,
  auditor_gps_lat NUMERIC(10,8),
  auditor_gps_lng NUMERIC(11,8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE audit_assignments ADD COLUMN IF NOT EXISTS blind_count BOOLEAN DEFAULT FALSE;
ALTER TABLE audit_assignments ADD COLUMN IF NOT EXISTS is_blind_audit BOOLEAN DEFAULT FALSE;
ALTER TABLE audit_assignments ADD COLUMN IF NOT EXISTS geofence_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE audit_assignments ADD COLUMN IF NOT EXISTS auditor_selfie_url TEXT;
ALTER TABLE audit_assignments ADD COLUMN IF NOT EXISTS auditor_gps_lat NUMERIC(10,8);
ALTER TABLE audit_assignments ADD COLUMN IF NOT EXISTS auditor_gps_lng NUMERIC(11,8);

-- 3. Bulk Audits Financial & Risk Enhancements
CREATE TABLE IF NOT EXISTS bulk_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site TEXT NOT NULL,
  item_id UUID,
  system_qty NUMERIC(12,2) DEFAULT 0,
  physical_qty NUMERIC(12,2) DEFAULT 0,
  variance_qty NUMERIC(12,2) DEFAULT 0,
  variance_value_inr NUMERIC(15,2) DEFAULT 0.00,
  risk_tier TEXT DEFAULT 'LOW',
  is_high_risk_anomaly BOOLEAN DEFAULT FALSE,
  matched_transfer_site TEXT,
  reasoning TEXT,
  audited_by UUID,
  frozen BOOLEAN DEFAULT TRUE,
  audited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bulk_audits ADD COLUMN IF NOT EXISTS variance_value_inr NUMERIC(15,2) DEFAULT 0.00;
ALTER TABLE bulk_audits ADD COLUMN IF NOT EXISTS risk_tier TEXT DEFAULT 'LOW'; -- 'LOW', 'MEDIUM', 'HIGH'
ALTER TABLE bulk_audits ADD COLUMN IF NOT EXISTS matched_transfer_site TEXT;

-- 4. Checklist Templates & Items Enhancements
CREATE TABLE IF NOT EXISTS checklist_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    frequency TEXT DEFAULT 'weekly',
    asset_type TEXT,
    created_by UUID,
    category_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checklist_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID,
    section TEXT,
    question TEXT NOT NULL,
    type TEXT DEFAULT 'pass_fail_na',
    is_critical_safety BOOLEAN DEFAULT FALSE,
    benchmark_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS is_critical_safety BOOLEAN DEFAULT FALSE;
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS benchmark_image_url TEXT;

-- 5. Approvals Governance & Escalation Enhancements
CREATE TABLE IF NOT EXISTS audit_approvals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    audit_id UUID NOT NULL,
    stage TEXT NOT NULL, -- 'CHECKER', 'HOD'
    approver_id UUID NOT NULL,
    approver_name TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    rejection_reason TEXT,
    e_signature_url TEXT,
    sla_expires_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_audit_approvals_audit ON audit_approvals(audit_id, status);
CREATE INDEX IF NOT EXISTS idx_bulk_audits_risk ON bulk_audits(risk_tier, is_high_risk_anomaly);

-- ── SECTION 6: Reports Hub & Custom Templates Schema ──

CREATE TABLE IF NOT EXISTS report_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    data_source TEXT NOT NULL DEFAULT 'assets', -- 'assets', 'audits', 'stock_reconciliation', 'checklists'
    fields JSONB DEFAULT '[]'::jsonb,
    group_by TEXT,
    filters JSONB DEFAULT '{}'::jsonb,
    owner_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE,
    cron_expression TEXT DEFAULT '0 8 * * 1',
    recipient_emails TEXT[],
    last_run_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_templates_owner ON report_templates(owner_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_active ON report_schedules(is_active);
