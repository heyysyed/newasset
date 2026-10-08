-- 1. Modify the Immutability Trigger to allow Cascading NULLs
-- We want to allow the database to set asset_id or work_order_id to NULL when the parent is deleted.
CREATE OR REPLACE FUNCTION prevent_event_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Allow if the only change is setting asset_id or work_order_id to NULL (e.g. during a cascade delete of the parent record)
        IF (NEW.asset_id IS NULL AND OLD.asset_id IS NOT NULL AND NEW.event_type = OLD.event_type AND NEW.reason IS NOT DISTINCT FROM OLD.reason AND NEW.metadata IS NOT DISTINCT FROM OLD.metadata) OR
           (NEW.work_order_id IS NULL AND OLD.work_order_id IS NOT NULL AND NEW.event_type = OLD.event_type) THEN
             
             -- Ensure all core ledger fields are unchanged
             IF NEW.id = OLD.id AND NEW.component_id = OLD.component_id AND NEW.event_type = OLD.event_type AND NEW.event_time = OLD.event_time AND NEW.location_id IS NOT DISTINCT FROM OLD.location_id AND NEW.previous_status IS NOT DISTINCT FROM OLD.previous_status AND NEW.new_status = OLD.new_status AND NEW.reason IS NOT DISTINCT FROM OLD.reason AND NEW.disposition IS NOT DISTINCT FROM OLD.disposition AND NEW.performed_by = OLD.performed_by THEN
                RETURN NEW;
             END IF;
        END IF;
    END IF;
    
    RAISE EXCEPTION 'Component lifecycle events are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

-- 2. Drop the existing foreign key constraint for asset_id
ALTER TABLE public.component_lifecycle_events 
DROP CONSTRAINT IF EXISTS component_lifecycle_events_asset_id_fkey;

-- 3. Re-add the foreign key constraint with ON DELETE SET NULL
ALTER TABLE public.component_lifecycle_events 
ADD CONSTRAINT component_lifecycle_events_asset_id_fkey
FOREIGN KEY (asset_id) 
REFERENCES public.assets(id) 
ON DELETE SET NULL;

-- 4. Drop the existing foreign key constraint for work_order_id
ALTER TABLE public.component_lifecycle_events 
DROP CONSTRAINT IF EXISTS component_lifecycle_events_work_order_id_fkey;

-- 5. Re-add the foreign key constraint with ON DELETE SET NULL
ALTER TABLE public.component_lifecycle_events 
ADD CONSTRAINT component_lifecycle_events_work_order_id_fkey
FOREIGN KEY (work_order_id) 
REFERENCES public.maintenance_work_orders(id) 
ON DELETE SET NULL;

-- 6. Do the same for component_replacements
ALTER TABLE public.component_replacements 
DROP CONSTRAINT IF EXISTS component_replacements_work_order_id_fkey;

ALTER TABLE public.component_replacements 
ADD CONSTRAINT component_replacements_work_order_id_fkey
FOREIGN KEY (work_order_id) 
REFERENCES public.maintenance_work_orders(id) 
ON DELETE SET NULL;
