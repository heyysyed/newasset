-- Phase 2 & 3: Serialized Component Lifecycle Management
-- Core Tables, Relationships, Constraints, Triggers, RPCs

-- 1. Serialized Components Table
CREATE TABLE IF NOT EXISTS public.serialized_components (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    serial_number TEXT UNIQUE NOT NULL,
    part_number TEXT,
    name TEXT NOT NULL,
    category TEXT,
    manufacturer TEXT,
    model TEXT,
    sku TEXT,
    status TEXT DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED', 'INSTALLED', 'UNDER_REPAIR', 'RETURNED_TO_VENDOR', 'SCRAPPED', 'DISPOSED', 'LOST', 'WRITTEN_OFF')),
    purchase_cost NUMERIC(15,2) DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    vendor_id UUID REFERENCES public.vendors(id),
    po_number TEXT,
    invoice_number TEXT,
    purchase_date DATE,
    warranty_start DATE,
    warranty_end DATE,
    current_asset_id UUID REFERENCES public.assets(id),
    current_location TEXT,
    included_in_asset_cost BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Asset Components (Installation Ledger)
CREATE TABLE IF NOT EXISTS public.asset_components (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    component_id UUID REFERENCES public.serialized_components(id) ON DELETE RESTRICT,
    position TEXT,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    installed_by UUID REFERENCES public.profiles(id),
    install_work_order_id UUID REFERENCES public.maintenance_work_orders(id),
    removed_at TIMESTAMPTZ,
    removed_by UUID REFERENCES public.profiles(id),
    remove_work_order_id UUID REFERENCES public.maintenance_work_orders(id),
    removal_reason TEXT,
    disposition TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_lifecycle_timeline CHECK (removed_at IS NULL OR installed_at <= removed_at)
);

-- MANDATORY Partial Unique Index: A component can only be installed in one asset at a time
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_component_install 
ON public.asset_components (component_id) 
WHERE removed_at IS NULL;

-- 3. Component Replacements (Replacement Ledger)
CREATE TABLE IF NOT EXISTS public.component_replacements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    old_component_id UUID REFERENCES public.serialized_components(id),
    new_component_id UUID REFERENCES public.serialized_components(id),
    work_order_id UUID REFERENCES public.maintenance_work_orders(id),
    replaced_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT,
    notes TEXT
);

-- 4. Component Lifecycle Events (Immutable Event Ledger)
CREATE TABLE IF NOT EXISTS public.component_lifecycle_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    component_id UUID REFERENCES public.serialized_components(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_time TIMESTAMPTZ DEFAULT NOW(),
    asset_id UUID REFERENCES public.assets(id),
    location_id TEXT,
    work_order_id UUID REFERENCES public.maintenance_work_orders(id),
    previous_status TEXT,
    new_status TEXT,
    reason TEXT,
    disposition TEXT,
    performed_by UUID REFERENCES public.profiles(id),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Extend Inventory Transactions
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS component_id UUID REFERENCES public.serialized_components(id) ON DELETE CASCADE;

-- 6. Trigger to enforce Immutability on component_lifecycle_events
CREATE OR REPLACE FUNCTION prevent_event_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Component lifecycle events are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_immutable_events ON public.component_lifecycle_events;
CREATE TRIGGER enforce_immutable_events
BEFORE UPDATE OR DELETE ON public.component_lifecycle_events
FOR EACH ROW
EXECUTE FUNCTION prevent_event_modification();

-- 7. RPC Functions (Atomic Lifecycle Operations)

-- A. Install Component
CREATE OR REPLACE FUNCTION rpc_install_component(
    p_component_id UUID,
    p_asset_id UUID,
    p_position TEXT,
    p_wo_id UUID,
    p_user_id UUID,
    p_location TEXT
) RETURNS JSONB AS $$
DECLARE
    v_comp RECORD;
    v_ac_id UUID;
BEGIN
    SELECT * INTO v_comp FROM public.serialized_components WHERE id = p_component_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Component not found'; END IF;
    IF v_comp.status != 'AVAILABLE' THEN RAISE EXCEPTION 'Component is not AVAILABLE for installation'; END IF;

    UPDATE public.serialized_components 
    SET status = 'INSTALLED', current_asset_id = p_asset_id, current_location = p_location, updated_at = NOW() 
    WHERE id = p_component_id;

    INSERT INTO public.asset_components (asset_id, component_id, position, installed_at, installed_by, install_work_order_id)
    VALUES (p_asset_id, p_component_id, p_position, NOW(), p_user_id, p_wo_id)
    RETURNING id INTO v_ac_id;

    INSERT INTO public.component_lifecycle_events (component_id, event_type, asset_id, work_order_id, previous_status, new_status, performed_by)
    VALUES (p_component_id, 'INSTALLED', p_asset_id, p_wo_id, v_comp.status, 'INSTALLED', p_user_id);

    INSERT INTO public.inventory_transactions (component_id, transaction_type, quantity, to_location, performed_by, notes)
    VALUES (p_component_id, 'issue', 1, p_location, p_user_id, 'COMPONENT_INSTALL');

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, entity_name, details)
    VALUES (p_user_id, 'COMPONENT_INSTALLED', 'component', p_component_id::text, v_comp.name, jsonb_build_object('asset_id', p_asset_id));

    RETURN jsonb_build_object('success', true, 'asset_component_id', v_ac_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. Remove Component
CREATE OR REPLACE FUNCTION rpc_remove_component(
    p_component_id UUID,
    p_wo_id UUID,
    p_reason TEXT,
    p_disposition TEXT,
    p_user_id UUID,
    p_new_status TEXT
) RETURNS JSONB AS $$
DECLARE
    v_comp RECORD;
    v_ac RECORD;
BEGIN
    SELECT * INTO v_comp FROM public.serialized_components WHERE id = p_component_id FOR UPDATE;
    IF v_comp.status != 'INSTALLED' THEN RAISE EXCEPTION 'Component is not currently INSTALLED'; END IF;

    SELECT * INTO v_ac FROM public.asset_components WHERE component_id = p_component_id AND removed_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active installation record not found'; END IF;

    UPDATE public.asset_components 
    SET removed_at = NOW(), removed_by = p_user_id, remove_work_order_id = p_wo_id, removal_reason = p_reason, disposition = p_disposition, updated_at = NOW()
    WHERE id = v_ac.id;

    UPDATE public.serialized_components 
    SET status = p_new_status, current_asset_id = NULL, updated_at = NOW() 
    WHERE id = p_component_id;

    INSERT INTO public.component_lifecycle_events (component_id, event_type, asset_id, work_order_id, previous_status, new_status, reason, disposition, performed_by)
    VALUES (p_component_id, 'REMOVED', v_ac.asset_id, p_wo_id, v_comp.status, p_new_status, p_reason, p_disposition, p_user_id);

    INSERT INTO public.inventory_transactions (component_id, transaction_type, quantity, from_location, performed_by, notes)
    VALUES (p_component_id, 'return', 1, v_comp.current_location, p_user_id, 'COMPONENT_REMOVE');

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, entity_name, details)
    VALUES (p_user_id, 'COMPONENT_REMOVED', 'component', p_component_id::text, v_comp.name, jsonb_build_object('asset_id', v_ac.asset_id, 'reason', p_reason));

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. Replace Component
CREATE OR REPLACE FUNCTION rpc_replace_component(
    p_old_id UUID,
    p_new_id UUID,
    p_asset_id UUID,
    p_position TEXT,
    p_wo_id UUID,
    p_reason TEXT,
    p_disposition TEXT,
    p_user_id UUID,
    p_old_new_status TEXT
) RETURNS JSONB AS $$
BEGIN
    PERFORM rpc_remove_component(p_old_id, p_wo_id, p_reason, p_disposition, p_user_id, p_old_new_status);
    PERFORM rpc_install_component(p_new_id, p_asset_id, p_position, p_wo_id, p_user_id, 'Asset ' || p_asset_id::text);
    
    INSERT INTO public.component_replacements (old_component_id, new_component_id, work_order_id, reason)
    VALUES (p_old_id, p_new_id, p_wo_id, p_reason);
    
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_user_id, 'COMPONENT_REPLACED', 'component', p_old_id::text, jsonb_build_object('new_component_id', p_new_id, 'asset_id', p_asset_id));
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- D. Scrap Component
CREATE OR REPLACE FUNCTION rpc_scrap_component(
    p_component_id UUID,
    p_reason TEXT,
    p_value NUMERIC,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_comp RECORD;
BEGIN
    SELECT * INTO v_comp FROM public.serialized_components WHERE id = p_component_id FOR UPDATE;
    IF v_comp.status = 'SCRAPPED' THEN RAISE EXCEPTION 'Component is already scrapped'; END IF;
    IF v_comp.status = 'INSTALLED' THEN RAISE EXCEPTION 'Cannot scrap an installed component. Remove it first.'; END IF;

    UPDATE public.serialized_components 
    SET status = 'SCRAPPED', updated_at = NOW() 
    WHERE id = p_component_id;

    INSERT INTO public.component_lifecycle_events (component_id, event_type, previous_status, new_status, reason, disposition, performed_by, metadata)
    VALUES (p_component_id, 'SCRAPPED', v_comp.status, 'SCRAPPED', p_reason, 'SCRAPPED', p_user_id, jsonb_build_object('scrap_value', p_value));
    
    INSERT INTO public.inventory_transactions (component_id, transaction_type, quantity, performed_by, notes)
    VALUES (p_component_id, 'adjustment', 1, p_user_id, 'COMPONENT_SCRAP');

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, entity_name, details)
    VALUES (p_user_id, 'COMPONENT_SCRAPPED', 'component', p_component_id::text, v_comp.name, jsonb_build_object('reason', p_reason, 'value', p_value));

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Setup RLS Policies for new tables
ALTER TABLE public.serialized_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.component_replacements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.component_lifecycle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON public.serialized_components FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.serialized_components FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all authenticated users" ON public.asset_components FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.asset_components FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all authenticated users" ON public.component_replacements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.component_replacements FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all authenticated users" ON public.component_lifecycle_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for authenticated users" ON public.component_lifecycle_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Explicitly DO NOT create UPDATE or DELETE policies for component_lifecycle_events
