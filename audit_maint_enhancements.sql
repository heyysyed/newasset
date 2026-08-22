-- ============================================================================
-- AUDIT & MAINTENANCE ENHANCEMENTS MIGRATION
-- Adds Audit Templates and Maintenance Approvals
-- ============================================================================

-- ── 1. MAINTENANCE APPROVALS ──────────────────────────────────────────────
ALTER TABLE public.maintenance_logs 
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Policy: Anyone can read logs, but only admins can approve/reject.
-- Note: existing RLS on maintenance_logs might need adjustment if users cannot read pending logs.

-- ── 2. AUDIT TEMPLATES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_filter TEXT, -- If null, applies to all categories
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  company_code TEXT
);

ALTER TABLE public.audit_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read audit_templates" ON public.audit_templates FOR SELECT USING (true);
CREATE POLICY "Allow admin all audit_templates" ON public.audit_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

CREATE TABLE IF NOT EXISTS public.audit_template_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.audit_templates(id) ON DELETE CASCADE,
  task_description TEXT NOT NULL,
  is_required BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

ALTER TABLE public.audit_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read audit_template_items" ON public.audit_template_items FOR SELECT USING (true);
CREATE POLICY "Allow admin all audit_template_items" ON public.audit_template_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- ── 3. AUDIT SESSION ENHANCEMENTS ────────────────────────────────────────
ALTER TABLE public.audit_sessions
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.audit_templates(id);

CREATE TABLE IF NOT EXISTS public.audit_item_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_item_id UUID REFERENCES public.audit_items(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES public.audit_template_items(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'pass', 'fail', 'na')),
  notes TEXT,
  checked_at TIMESTAMPTZ,
  UNIQUE(audit_item_id, template_item_id)
);

ALTER TABLE public.audit_item_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read audit_item_results" ON public.audit_item_results FOR SELECT USING (true);
CREATE POLICY "Allow all insert audit_item_results" ON public.audit_item_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update audit_item_results" ON public.audit_item_results FOR UPDATE USING (true);
CREATE POLICY "Allow all delete audit_item_results" ON public.audit_item_results FOR DELETE USING (true);
