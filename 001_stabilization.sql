-- ============================================================
-- PHASE 1: STABILIZATION, SECURITY & DATA INTEGRITY
-- Migration 001: Stabilization
-- ============================================================

-- ── 1. REPAIR MISSING SITE ASSIGNMENTS TABLE ─────────────
-- The frontend (AuthContext) expects 'user_site_assignments' 
-- to manage site-based data access boundaries for non-admin users.
CREATE TABLE IF NOT EXISTS public.user_site_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, site_name)
);

ALTER TABLE public.user_site_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_site_assignments_read" ON public.user_site_assignments FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "user_site_assignments_write" ON public.user_site_assignments FOR ALL 
  USING (public.is_admin());


-- ── 2. DATA INTEGRITY: NEGATIVE INVENTORY ────────────────
-- Prevent current_stock from dropping below zero.
-- Note: We must deal with existing negative records first.
-- The actual ADD CONSTRAINT statement is commented out until 
-- data is sanitized, or we apply it dynamically.
ALTER TABLE public.inventory_items ADD CONSTRAINT current_stock_positive CHECK (current_stock >= 0);


-- ── 3. RLS HARDENING: PROFILES ───────────────────────────
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

-- Admins and Moderators can see all profiles.
-- Regular users can only see their own profile, OR profiles 
-- of users assigned to the same sites (useful for assignee dropdowns).
CREATE POLICY "profiles_select_secured" ON public.profiles FOR SELECT 
  USING (
    public.is_admin() OR 
    public.is_moderator() OR 
    id = auth.uid() OR
    id IN (
      SELECT user_id FROM public.user_site_assignments 
      WHERE site_name IN (
        SELECT site_name FROM public.user_site_assignments WHERE user_id = auth.uid()
      )
    )
  );

-- ── 4. RLS HARDENING: ASSETS ─────────────────────────────
DROP POLICY IF EXISTS "assets_read_auth" ON public.assets;

-- Admins/Moderators: View all
-- Users: View assets that belong to their assigned sites, OR assets assigned directly to them.
CREATE POLICY "assets_read_secured" ON public.assets FOR SELECT 
  USING (
    public.is_admin() OR 
    public.is_moderator() OR 
    assigned_to = auth.uid() OR 
    site IN (SELECT site_name FROM public.user_site_assignments WHERE user_id = auth.uid())
  );

-- Only Admins/Moderators can insert/update/delete assets.
-- This depends on the actual intended permission structure, but the default 
-- UI hides edit buttons from 'user' role. We must enforce this in DB.
DROP POLICY IF EXISTS "assets_write_auth" ON public.assets;
CREATE POLICY "assets_write_secured" ON public.assets FOR ALL
  USING (
    public.is_admin() OR public.is_moderator()
  );

-- ── 5. RLS HARDENING: MAINTENANCE ────────────────────────
DROP POLICY IF EXISTS "maint_sched_auth" ON public.maintenance_schedules;

-- Users can view schedules for assets in their sites.
CREATE POLICY "maint_sched_read_secured" ON public.maintenance_schedules FOR SELECT 
  USING (
    public.is_admin() OR 
    public.is_moderator() OR 
    asset_id IN (
      SELECT id FROM public.assets WHERE site IN (
        SELECT site_name FROM public.user_site_assignments WHERE user_id = auth.uid()
      )
    )
  );

-- Write restricted to Admins/Moderators.
CREATE POLICY "maint_sched_write_secured" ON public.maintenance_schedules FOR INSERT 
  WITH CHECK (public.is_admin() OR public.is_moderator());
CREATE POLICY "maint_sched_update_secured" ON public.maintenance_schedules FOR UPDATE 
  USING (public.is_admin() OR public.is_moderator());
CREATE POLICY "maint_sched_delete_secured" ON public.maintenance_schedules FOR DELETE 
  USING (public.is_admin() OR public.is_moderator());

-- Note: Similar hardening must be extended to all other modules.
-- ── 6. RLS HARDENING: INVENTORY ITEMS ───────────────────────
DROP POLICY IF EXISTS "inv_items_auth" ON public.inventory_items;

CREATE POLICY "inv_items_read_secured" ON public.inventory_items FOR SELECT 
  USING (
    public.is_admin() OR 
    public.is_moderator() OR 
    site IN (SELECT site_name FROM public.user_site_assignments WHERE user_id = auth.uid())
  );

CREATE POLICY "inv_items_write_secured" ON public.inventory_items FOR ALL
  USING (public.is_admin() OR public.is_moderator());

-- ── 7. RLS HARDENING: MAINTENANCE TICKETS ─────────────────
DROP POLICY IF EXISTS "tickets_auth" ON public.maintenance_tickets;

CREATE POLICY "tickets_read_secured" ON public.maintenance_tickets FOR SELECT 
  USING (
    public.is_admin() OR 
    public.is_moderator() OR 
    asset_id IN (
      SELECT id FROM public.assets WHERE site IN (
        SELECT site_name FROM public.user_site_assignments WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "tickets_write_secured" ON public.maintenance_tickets FOR ALL
  USING (public.is_admin() OR public.is_moderator() OR created_by = auth.uid());

-- ── 8. RLS HARDENING: ASSET MOVEMENTS ─────────────────────
DROP POLICY IF EXISTS "movements_auth" ON public.asset_movements;

CREATE POLICY "movements_read_secured" ON public.asset_movements FOR SELECT 
  USING (
    public.is_admin() OR 
    public.is_moderator() OR 
    asset_id IN (
      SELECT id FROM public.assets WHERE site IN (
        SELECT site_name FROM public.user_site_assignments WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "movements_write_secured" ON public.asset_movements FOR ALL
  USING (public.is_admin() OR public.is_moderator() OR moved_by = auth.uid());
