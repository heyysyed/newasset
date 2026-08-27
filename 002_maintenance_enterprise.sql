-- =================================================================================
-- 002_maintenance_enterprise.sql
-- Description: Phase 1 Data-Layer Implementation for Maintenance Enterprise Upgrade
-- =================================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MAINTENANCE CONFIGURATION
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    critical_sla_hours INTEGER DEFAULT 4,
    high_sla_hours INTEGER DEFAULT 24,
    normal_sla_hours INTEGER DEFAULT 72,
    low_sla_hours INTEGER DEFAULT 168,
    approval_threshold NUMERIC(15,2) DEFAULT 500.00,
    approval_currency TEXT DEFAULT 'USD',
    auto_generate_pm_tasks BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id)
);

-- Ensure only one config row exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_maintenance_config ON public.maintenance_config((1));

ALTER TABLE public.maintenance_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_read_all" ON public.maintenance_config 
    FOR SELECT USING (auth.role() = 'authenticated');
    
CREATE POLICY "config_update_admin" ON public.maintenance_config 
    FOR UPDATE USING (public.is_moderator());

-- Insert default config if not exists
INSERT INTO public.maintenance_config (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.maintenance_config);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. MAINTENANCE AUDIT EVENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_audit_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('ticket', 'work_order', 'schedule', 'config', 'inventory')),
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    actor_id UUID REFERENCES public.profiles(id),
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.maintenance_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_insert_all" ON public.maintenance_audit_events 
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    
CREATE POLICY "audit_read_all" ON public.maintenance_audit_events 
    FOR SELECT USING (auth.role() = 'authenticated');

-- Trigger to prevent updating or deleting audit logs
CREATE OR REPLACE FUNCTION public.fn_prevent_maintenance_audit_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Maintenance audit events are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_maint_audit_update ON public.maintenance_audit_events;
CREATE TRIGGER trg_prevent_maint_audit_update
    BEFORE UPDATE OR DELETE ON public.maintenance_audit_events
    FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_maintenance_audit_mutation();

CREATE INDEX IF NOT EXISTS idx_maint_audit_entity ON public.maintenance_audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_maint_audit_created_at ON public.maintenance_audit_events(created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. IDEMPOTENT PM AUTO-GENERATION (Modifying Tickets)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.maintenance_tickets 
ADD COLUMN IF NOT EXISTS source_schedule_date DATE;

-- Unique constraint to prevent duplicate PM tasks for the same schedule on the same day
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_schedule_occurrence'
    ) THEN
        ALTER TABLE public.maintenance_tickets 
        ADD CONSTRAINT uq_schedule_occurrence UNIQUE (source_schedule_id, source_schedule_date);
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MAINTENANCE WORK ORDERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_work_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    work_order_number TEXT UNIQUE NOT NULL,
    ticket_id UUID REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    site_id TEXT, -- Adjust if site is a UUID reference in AssetPro
    assigned_to UUID REFERENCES public.profiles(id),
    vendor_id UUID REFERENCES public.vendors(id),
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'AWAITING_APPROVAL', 'CLOSED', 'CANCELLED')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    description TEXT,
    
    -- Time Tracking
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    total_pause_duration INTERVAL DEFAULT '0'::interval,
    estimated_hours NUMERIC(10,2),
    actual_hours NUMERIC(10,2),
    
    -- Financials
    estimated_cost NUMERIC(15,2),
    actual_cost NUMERIC(15,2),
    
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Sequence for Work Order numbers
CREATE SEQUENCE IF NOT EXISTS work_order_number_seq START 1000;

ALTER TABLE public.maintenance_work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_orders_read" ON public.maintenance_work_orders 
    FOR SELECT USING (auth.role() = 'authenticated');
    
CREATE POLICY "work_orders_insert" ON public.maintenance_work_orders 
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "work_orders_update" ON public.maintenance_work_orders 
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_maint_wo_ticket ON public.maintenance_work_orders(ticket_id);
CREATE INDEX IF NOT EXISTS idx_maint_wo_status ON public.maintenance_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_maint_wo_assigned ON public.maintenance_work_orders(assigned_to);

-- Function to validate Work Order State Transitions
CREATE OR REPLACE FUNCTION public.fn_validate_wo_state_transition()
RETURNS trigger AS $$
BEGIN
    -- If status hasn't changed, allow
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Define allowed transitions
    IF OLD.status = 'DRAFT' AND NEW.status NOT IN ('SCHEDULED', 'ASSIGNED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Invalid transition from DRAFT to %', NEW.status;
    ELSIF OLD.status = 'SCHEDULED' AND NEW.status NOT IN ('ASSIGNED', 'CANCELLED', 'DRAFT') THEN
        RAISE EXCEPTION 'Invalid transition from SCHEDULED to %', NEW.status;
    ELSIF OLD.status = 'ASSIGNED' AND NEW.status NOT IN ('IN_PROGRESS', 'CANCELLED', 'SCHEDULED') THEN
        RAISE EXCEPTION 'Invalid transition from ASSIGNED to %', NEW.status;
    ELSIF OLD.status = 'IN_PROGRESS' AND NEW.status NOT IN ('ON_HOLD', 'COMPLETED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Invalid transition from IN_PROGRESS to %', NEW.status;
    ELSIF OLD.status = 'ON_HOLD' AND NEW.status NOT IN ('IN_PROGRESS', 'CANCELLED') THEN
        RAISE EXCEPTION 'Invalid transition from ON_HOLD to %', NEW.status;
    ELSIF OLD.status = 'COMPLETED' AND NEW.status NOT IN ('AWAITING_APPROVAL', 'CLOSED') THEN
        RAISE EXCEPTION 'Invalid transition from COMPLETED to %', NEW.status;
    ELSIF OLD.status = 'AWAITING_APPROVAL' AND NEW.status NOT IN ('CLOSED', 'IN_PROGRESS') THEN
        RAISE EXCEPTION 'Invalid transition from AWAITING_APPROVAL to %', NEW.status;
    ELSIF OLD.status IN ('CLOSED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Cannot transition from terminal state %', OLD.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_wo_status ON public.maintenance_work_orders;
CREATE TRIGGER trg_validate_wo_status
    BEFORE UPDATE OF status ON public.maintenance_work_orders
    FOR EACH ROW EXECUTE FUNCTION public.fn_validate_wo_state_transition();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INVENTORY TRANSACTION INTEGRITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.inventory_transactions 
ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES public.maintenance_tickets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES public.maintenance_work_orders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS total_cost NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS is_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS override_reason TEXT;

-- Update the Inventory Balance Trigger to prevent negative stock without override
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
  
  -- Negative Stock Protection
  IF v_new_stock < 0 AND NEW.is_override != true THEN
    RAISE EXCEPTION 'Insufficient stock. Transaction would result in negative balance (%). Use override if authorized.', v_new_stock;
  END IF;

  UPDATE public.inventory_items SET current_stock = v_new_stock, updated_at = NOW() WHERE id = NEW.item_id;

  NEW.balance_after := v_new_stock;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger just in case
DROP TRIGGER IF EXISTS inventory_balance_trigger ON public.inventory_transactions;
CREATE TRIGGER inventory_balance_trigger
  BEFORE INSERT ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_inventory_balance();

-- RPC for atomic inventory consumption
CREATE OR REPLACE FUNCTION public.fn_consume_maintenance_part(
    p_item_id UUID,
    p_quantity NUMERIC,
    p_work_order_id UUID,
    p_technician_id UUID,
    p_is_override BOOLEAN DEFAULT false,
    p_override_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_wo RECORD;
    v_total_cost NUMERIC;
    v_tx_id UUID;
BEGIN
    -- Validate Work Order
    SELECT * INTO v_wo FROM public.maintenance_work_orders WHERE id = p_work_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Work order not found';
    END IF;

    -- Validate Item
    SELECT * INTO v_item FROM public.inventory_items WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory item not found';
    END IF;

    v_total_cost := v_item.unit_cost * p_quantity;

    -- Insert Transaction (Trigger handles stock check and deduction)
    INSERT INTO public.inventory_transactions (
        item_id, transaction_type, quantity, performed_by, 
        work_order_id, ticket_id, asset_id, unit_cost, total_cost,
        is_override, override_reason, reference
    ) VALUES (
        p_item_id, 'issue', p_quantity, p_technician_id,
        p_work_order_id, v_wo.ticket_id, v_wo.asset_id, v_item.unit_cost, v_total_cost,
        p_is_override, p_override_reason, 'WO-' || v_wo.work_order_number
    ) RETURNING id INTO v_tx_id;
    
    -- Insert Audit Event
    INSERT INTO public.maintenance_audit_events (
        entity_type, entity_id, action, actor_id, new_value
    ) VALUES (
        'work_order', p_work_order_id, 'part_consumed', p_technician_id, 
        jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity, 'cost', v_total_cost)
    );

    RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id);
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC FOR IDEMPOTENT PM GENERATION
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_generate_pm_occurrences(p_due_date DATE)
RETURNS INTEGER AS $$
DECLARE
    v_sched RECORD;
    v_count INTEGER := 0;
    v_ticket_no TEXT;
    v_ticket_id UUID;
    v_seq_val BIGINT;
BEGIN
    FOR v_sched IN 
        SELECT * FROM public.maintenance_schedules 
        WHERE status = 'active' AND next_due <= p_due_date
    LOOP
        -- Attempt to insert ticket. Constraint uq_schedule_occurrence handles idempotency
        BEGIN
            v_seq_val := nextval('ticket_number_seq');
            v_ticket_no := 'TKT-' || v_seq_val;
            
            INSERT INTO public.maintenance_tickets (
                ticket_no, asset_id, title, description, ticket_type, priority, status,
                source_schedule_id, source_schedule_date
            ) VALUES (
                v_ticket_no, v_sched.asset_id, 'PM: ' || v_sched.title, v_sched.description, 'scheduled', 'normal', 'open',
                v_sched.id, v_sched.next_due
            ) RETURNING id INTO v_ticket_id;
            
            -- Insert Audit Event
            INSERT INTO public.maintenance_audit_events (
                entity_type, entity_id, action, actor_id, metadata
            ) VALUES (
                'schedule', v_sched.id, 'pm_generated', v_sched.created_by, jsonb_build_object('ticket_id', v_ticket_id)
            );
            
            v_count := v_count + 1;
            
            -- Update Schedule next_due based on frequency
            -- Note: Simple recurrence update, should ideally use an interval mapping
            UPDATE public.maintenance_schedules 
            SET last_done = v_sched.next_due,
                next_due = CASE 
                    WHEN frequency = 'daily' THEN v_sched.next_due + INTERVAL '1 day'
                    WHEN frequency = 'weekly' THEN v_sched.next_due + INTERVAL '1 week'
                    WHEN frequency = 'monthly' THEN v_sched.next_due + INTERVAL '1 month'
                    WHEN frequency = 'quarterly' THEN v_sched.next_due + INTERVAL '3 months'
                    WHEN frequency = 'yearly' THEN v_sched.next_due + INTERVAL '1 year'
                    ELSE v_sched.next_due -- Handle 'one_time' or unknown separately
                END
            WHERE id = v_sched.id;
            
        EXCEPTION WHEN unique_violation THEN
            -- Idempotency hit: Ticket for this schedule occurrence already exists. Skip safely.
            CONTINUE;
        END;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. NOTIFY/LISTEN SETUP FOR REALTIME (Optional, useful if doing selective realtime)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN 
    ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_work_orders; 
EXCEPTION WHEN others THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- END OF MIGRATION
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure scheduled is a valid ticket type
ALTER TABLE public.maintenance_tickets DROP CONSTRAINT IF EXISTS maintenance_tickets_ticket_type_check;
ALTER TABLE public.maintenance_tickets ADD CONSTRAINT maintenance_tickets_ticket_type_check CHECK (ticket_type IN ('breakdown','fault','damage','inspection','scheduled','other'));

