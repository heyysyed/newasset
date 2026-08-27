-- ═══════════════════════════════════════════════════════════════════════════════
-- 004_parts_lifecycle_integration.sql
--
-- PURPOSE
--   Consolidates the three previously disconnected inventory models into TWO
--   explicit tracks, and wires Asset <-> Inventory <-> Maintenance end to end so
--   that a repair which swaps a hard drive is fully traceable and costed.
--
--   TRACK 1 - SERIALIZED  (serialized_components)
--     Every unit has its own serial number. Hard drives, SSDs, motherboards,
--     batteries, motors. Full lifecycle: received -> installed in asset ->
--     removed -> repaired / returned to vendor / SCRAPPED.
--
--   TRACK 2 - BULK  (bulk_items + bulk_site_stock + bulk_transactions)
--     Quantity only, no per-unit identity. Thermal paste, screws, cable, oil.
--     Consumed against a work order and costed, but not individually tracked.
--
--   inventory_items is RETIRED. Its rows are migrated into the BULK track and
--   the table is renamed to inventory_items_archive so that any missed code
--   reference fails loudly instead of silently reading a dead table.
--
-- SAFETY
--   Idempotent (safe to re-run). Wrapped in a single transaction.
--   No data is deleted. A rollback script is provided at the bottom.
--
-- RUN
--   Supabase Dashboard -> SQL Editor -> paste -> Run.
--   Requires 003_components_lifecycle.sql to have been applied first.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 0. PRE-FLIGHT
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = 'serialized_components') THEN
        RAISE EXCEPTION '003_components_lifecycle.sql must be applied before this migration.';
    END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1. COLUMNS THE APPLICATION CODE ALREADY WRITES BUT WERE NEVER DECLARED
--
-- The frontend reads/writes assets.condition, assets.company_code and
-- assets.image_url. None of them existed in any checked-in DDL, so every asset
-- query filtering on company_code and every condition update was failing.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS condition TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS company_code TEXT DEFAULT 'SBC';
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE public.assets SET company_code = 'SBC' WHERE company_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_assets_company_code ON public.assets (company_code);

-- The AssetForm offers 'Declining Balance' but the CHECK constraint only allowed
-- 'Straight Line' / 'Reducing Balance', so those saves failed. Accept all three
-- spellings and normalise the synonym.
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_depreciation_method_check;
ALTER TABLE public.assets ADD CONSTRAINT assets_depreciation_method_check
    CHECK (depreciation_method IN ('Straight Line', 'Reducing Balance', 'Declining Balance'));

UPDATE public.assets SET depreciation_method = 'Reducing Balance'
 WHERE depreciation_method = 'Declining Balance';


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2. BULK TRACK - BRING IT UP TO PARITY WITH inventory_items
--
-- bulk_items was a thin scaffolding catalogue. To absorb inventory_items it
-- needs costing, reorder thresholds, bin location, vendor and a spare-part flag
-- so maintenance can filter to just the things it may consume.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.bulk_items ADD COLUMN IF NOT EXISTS part_number          TEXT;
ALTER TABLE public.bulk_items ADD COLUMN IF NOT EXISTS manufacturer         TEXT;
ALTER TABLE public.bulk_items ADD COLUMN IF NOT EXISTS reorder_level        NUMERIC(15,3) DEFAULT 0;
ALTER TABLE public.bulk_items ADD COLUMN IF NOT EXISTS min_order_qty        NUMERIC(15,3) DEFAULT 0;
ALTER TABLE public.bulk_items ADD COLUMN IF NOT EXISTS location_bin         TEXT;
ALTER TABLE public.bulk_items ADD COLUMN IF NOT EXISTS preferred_vendor_id  UUID REFERENCES public.vendors(id);
ALTER TABLE public.bulk_items ADD COLUMN IF NOT EXISTS image_url            TEXT;
ALTER TABLE public.bulk_items ADD COLUMN IF NOT EXISTS unit_price           NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.bulk_items ADD COLUMN IF NOT EXISTS currency             TEXT DEFAULT 'INR';
-- is_spare_part = true means "maintenance may consume this against a work order"
ALTER TABLE public.bulk_items ADD COLUMN IF NOT EXISTS is_spare_part        BOOLEAN DEFAULT false;
-- Provenance marker for rows that arrived here from the retired table
ALTER TABLE public.bulk_items ADD COLUMN IF NOT EXISTS migrated_from_inventory_item_id UUID;

ALTER TABLE public.bulk_site_stock ADD COLUMN IF NOT EXISTS unit_price    NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.bulk_site_stock ADD COLUMN IF NOT EXISTS reorder_level NUMERIC(15,3) DEFAULT 0;
ALTER TABLE public.bulk_site_stock ADD COLUMN IF NOT EXISTS location_bin  TEXT;

UPDATE public.bulk_items      SET unit_price = 0 WHERE unit_price IS NULL;
UPDATE public.bulk_site_stock SET unit_price = 0 WHERE unit_price IS NULL;

CREATE INDEX IF NOT EXISTS idx_bulk_items_spare  ON public.bulk_items (is_spare_part) WHERE is_spare_part;
CREATE INDEX IF NOT EXISTS idx_bulk_items_active ON public.bulk_items (is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bulk_items_migrated_src
    ON public.bulk_items (migrated_from_inventory_item_id)
    WHERE migrated_from_inventory_item_id IS NOT NULL;

-- bulk_transactions needs to record consumption against maintenance and cost,
-- mirroring what inventory_transactions gained in 002.
ALTER TABLE public.bulk_transactions ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES public.maintenance_work_orders(id);
ALTER TABLE public.bulk_transactions ADD COLUMN IF NOT EXISTS ticket_id     UUID REFERENCES public.maintenance_tickets(id);
ALTER TABLE public.bulk_transactions ADD COLUMN IF NOT EXISTS asset_id      UUID REFERENCES public.assets(id);
ALTER TABLE public.bulk_transactions ADD COLUMN IF NOT EXISTS unit_cost     NUMERIC(15,2);
ALTER TABLE public.bulk_transactions ADD COLUMN IF NOT EXISTS total_cost    NUMERIC(15,2);

-- 'consume' is how maintenance draws a bulk part; 'issue' kept as a synonym for
-- any legacy rows. The original scaffolding verbs are preserved.
ALTER TABLE public.bulk_transactions DROP CONSTRAINT IF EXISTS bulk_transactions_transaction_type_check;
ALTER TABLE public.bulk_transactions ADD CONSTRAINT bulk_transactions_transaction_type_check
    CHECK (transaction_type IN ('receipt','transfer','deploy','dismantle','scrap',
                                'adjustment','consume','issue','return'));

CREATE INDEX IF NOT EXISTS idx_bulk_tx_work_order ON public.bulk_transactions (work_order_id);
CREATE INDEX IF NOT EXISTS idx_bulk_tx_asset      ON public.bulk_transactions (asset_id);
CREATE INDEX IF NOT EXISTS idx_bulk_tx_item       ON public.bulk_transactions (item_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3. SERIALIZED TRACK - MISSING FIELDS
--
-- The user requirement is that a scrapped part keeps its full purchase history
-- and that its cost rolls into the parent asset. That needs a scrap value, a
-- scrap timestamp, and an explicit capitalise-or-expense decision.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.serialized_components ADD COLUMN IF NOT EXISTS scrap_value      NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.serialized_components ADD COLUMN IF NOT EXISTS scrapped_at      TIMESTAMPTZ;
ALTER TABLE public.serialized_components ADD COLUMN IF NOT EXISTS scrap_reason     TEXT;
ALTER TABLE public.serialized_components ADD COLUMN IF NOT EXISTS notes            TEXT;
ALTER TABLE public.serialized_components ADD COLUMN IF NOT EXISTS site             TEXT;
ALTER TABLE public.serialized_components ADD COLUMN IF NOT EXISTS unit            TEXT DEFAULT 'nos';
ALTER TABLE public.serialized_components ADD COLUMN IF NOT EXISTS received_by      UUID REFERENCES public.profiles(id);
ALTER TABLE public.serialized_components ADD COLUMN IF NOT EXISTS reorder_level    NUMERIC(15,3) DEFAULT 0;

-- Parts installed into an asset count toward that asset's combined value by
-- default. Set to false on a specific part to treat it as a repair expense.
ALTER TABLE public.serialized_components
    ALTER COLUMN included_in_asset_cost SET DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_sc_status        ON public.serialized_components (status);
CREATE INDEX IF NOT EXISTS idx_sc_current_asset ON public.serialized_components (current_asset_id);
CREATE INDEX IF NOT EXISTS idx_sc_category      ON public.serialized_components (category);
CREATE INDEX IF NOT EXISTS idx_sc_serial        ON public.serialized_components (serial_number);

CREATE INDEX IF NOT EXISTS idx_ac_asset         ON public.asset_components (asset_id);
CREATE INDEX IF NOT EXISTS idx_ac_component     ON public.asset_components (component_id);
CREATE INDEX IF NOT EXISTS idx_ac_active        ON public.asset_components (asset_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cle_component    ON public.component_lifecycle_events (component_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4. UNIFIED PARTS LEDGER
--
-- inventory_transactions already carried component_id, work_order_id, ticket_id,
-- asset_id, unit_cost and total_cost from 002/003. It becomes the single ledger
-- for BOTH tracks. Adding bulk_item_id lets a bulk consumption land here too, so
-- one query answers "everything consumed against this work order".
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.inventory_transactions
    ADD COLUMN IF NOT EXISTS bulk_item_id UUID REFERENCES public.bulk_items(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_transactions
    ADD COLUMN IF NOT EXISTS site TEXT;

ALTER TABLE public.inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;
ALTER TABLE public.inventory_transactions ADD CONSTRAINT inventory_transactions_transaction_type_check
    CHECK (transaction_type IN ('receipt','issue','transfer','adjustment','adjustment_in',
                                'purchase','return','consume','scrap','install','remove'));

CREATE INDEX IF NOT EXISTS idx_it_bulk_item  ON public.inventory_transactions (bulk_item_id);
CREATE INDEX IF NOT EXISTS idx_it_component  ON public.inventory_transactions (component_id);
CREATE INDEX IF NOT EXISTS idx_it_work_order ON public.inventory_transactions (work_order_id);
CREATE INDEX IF NOT EXISTS idx_it_asset      ON public.inventory_transactions (asset_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5. MIGRATE inventory_items INTO THE BULK TRACK
--
-- Every legacy item becomes a bulk_items row flagged is_spare_part = true (it
-- was a spare/consumable by definition). current_stock lands in bulk_site_stock
-- under its recorded location, defaulting to 'MAIN STORE' when blank.
-- item_code collisions reuse the existing bulk row rather than duplicating.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    v_rec       RECORD;
    v_bulk_id   UUID;
    v_site      TEXT;
    v_migrated  INTEGER := 0;
    v_linked    INTEGER := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = 'inventory_items') THEN
        RAISE NOTICE 'inventory_items not present - migration already completed. Skipping.';
        RETURN;
    END IF;

    FOR v_rec IN SELECT * FROM public.inventory_items LOOP

        v_site := COALESCE(NULLIF(TRIM(v_rec.location), ''), 'MAIN STORE');

        -- Already migrated on a previous run?
        SELECT id INTO v_bulk_id FROM public.bulk_items
         WHERE migrated_from_inventory_item_id = v_rec.id;

        IF v_bulk_id IS NULL THEN
            -- Reuse a bulk row that already owns this item_code
            SELECT id INTO v_bulk_id FROM public.bulk_items WHERE item_code = v_rec.item_code;

            IF v_bulk_id IS NULL THEN
                INSERT INTO public.bulk_items (
                    item_code, item_name, category, unit, unit_price, currency,
                    reorder_level, min_order_qty, location_bin, preferred_vendor_id,
                    image_url, notes, is_active, is_spare_part,
                    migrated_from_inventory_item_id
                ) VALUES (
                    v_rec.item_code, v_rec.item_name, v_rec.category,
                    COALESCE(v_rec.unit, 'pcs'), COALESCE(v_rec.unit_cost, 0), 'INR',
                    COALESCE(v_rec.reorder_level, 0), COALESCE(v_rec.min_order_qty, 0),
                    v_rec.location_bin, v_rec.preferred_vendor_id,
                    v_rec.image_url, v_rec.notes, COALESCE(v_rec.is_active, true), true,
                    v_rec.id
                ) RETURNING id INTO v_bulk_id;
                v_migrated := v_migrated + 1;
            ELSE
                -- Enrich the existing bulk row with the legacy costing data
                UPDATE public.bulk_items SET
                    unit_price          = CASE WHEN COALESCE(unit_price,0) = 0
                                               THEN COALESCE(v_rec.unit_cost, 0) ELSE unit_price END,
                    reorder_level       = CASE WHEN COALESCE(reorder_level,0) = 0
                                               THEN COALESCE(v_rec.reorder_level, 0) ELSE reorder_level END,
                    location_bin        = COALESCE(location_bin, v_rec.location_bin),
                    preferred_vendor_id = COALESCE(preferred_vendor_id, v_rec.preferred_vendor_id),
                    image_url           = COALESCE(image_url, v_rec.image_url),
                    is_spare_part       = true,
                    migrated_from_inventory_item_id = v_rec.id,
                    updated_at          = NOW()
                WHERE id = v_bulk_id;
                v_linked := v_linked + 1;
            END IF;
        END IF;

        -- Seed site stock from the legacy running balance
        IF COALESCE(v_rec.current_stock, 0) <> 0 THEN
            INSERT INTO public.bulk_site_stock (item_id, site, usable_qty, unit_price, reorder_level, location_bin)
            VALUES (v_bulk_id, v_site, v_rec.current_stock,
                    COALESCE(v_rec.unit_cost, 0), COALESCE(v_rec.reorder_level, 0), v_rec.location_bin)
            ON CONFLICT (item_id, site) DO UPDATE
                SET usable_qty = GREATEST(bulk_site_stock.usable_qty, EXCLUDED.usable_qty),
                    unit_price = CASE WHEN COALESCE(bulk_site_stock.unit_price,0) = 0
                                      THEN EXCLUDED.unit_price ELSE bulk_site_stock.unit_price END,
                    updated_at = NOW();
        END IF;

        -- Repoint the historical ledger at the new bulk row
        UPDATE public.inventory_transactions
           SET bulk_item_id = v_bulk_id
         WHERE item_id = v_rec.id AND bulk_item_id IS NULL;

    END LOOP;

    RAISE NOTICE 'inventory_items migration: % new bulk_items, % linked to existing.', v_migrated, v_linked;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6. REPOINT THE REMAINING FOREIGN KEYS OFF inventory_items
--
-- gate_pass_items, stock_transfers and inventory_requests all pointed at the
-- retired table. Each gains a bulk_item_id, backfilled through the provenance
-- marker, so no history is lost.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.gate_pass_items
    ADD COLUMN IF NOT EXISTS bulk_item_id UUID REFERENCES public.bulk_items(id) ON DELETE SET NULL;
ALTER TABLE public.gate_pass_items
    ADD COLUMN IF NOT EXISTS component_id UUID REFERENCES public.serialized_components(id) ON DELETE SET NULL;
ALTER TABLE public.gate_pass_items
    ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'other';

ALTER TABLE public.gate_pass_items DROP CONSTRAINT IF EXISTS gate_pass_items_item_type_check;
ALTER TABLE public.gate_pass_items ADD CONSTRAINT gate_pass_items_item_type_check
    CHECK (item_type IN ('asset','inventory','bulk','component','other'));

UPDATE public.gate_pass_items gpi
   SET bulk_item_id = bi.id
  FROM public.bulk_items bi
 WHERE bi.migrated_from_inventory_item_id = gpi.inventory_item_id
   AND gpi.bulk_item_id IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='stock_transfers') THEN
        ALTER TABLE public.stock_transfers
            ADD COLUMN IF NOT EXISTS bulk_item_id UUID REFERENCES public.bulk_items(id) ON DELETE SET NULL;
        UPDATE public.stock_transfers st
           SET bulk_item_id = bi.id
          FROM public.bulk_items bi
         WHERE bi.migrated_from_inventory_item_id = st.item_id
           AND st.bulk_item_id IS NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='inventory_requests') THEN
        ALTER TABLE public.inventory_requests
            ADD COLUMN IF NOT EXISTS bulk_item_id UUID REFERENCES public.bulk_items(id) ON DELETE SET NULL;
        ALTER TABLE public.inventory_requests
            ADD COLUMN IF NOT EXISTS component_id UUID REFERENCES public.serialized_components(id) ON DELETE SET NULL;
        UPDATE public.inventory_requests ir
           SET bulk_item_id = bi.id
          FROM public.bulk_items bi
         WHERE bi.migrated_from_inventory_item_id = ir.item_id
           AND ir.bulk_item_id IS NULL;
    END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7. RETIRE inventory_items
--
-- The stock-balance trigger is dropped first: it was double-counting against the
-- manual decrement in logMaintenanceWork(). All stock movement is now explicit,
-- through RPCs, with no hidden trigger arithmetic.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_update_inventory_balance ON public.inventory_transactions;
DROP TRIGGER IF EXISTS update_inventory_balance     ON public.inventory_transactions;
DROP FUNCTION IF EXISTS public.update_inventory_balance() CASCADE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='inventory_items')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables
                       WHERE table_schema='public' AND table_name='inventory_items_archive') THEN
        ALTER TABLE public.inventory_items RENAME TO inventory_items_archive;
        RAISE NOTICE 'inventory_items renamed to inventory_items_archive (data preserved, read-only).';
    END IF;
END $$;

COMMENT ON TABLE public.inventory_items_archive IS
    'RETIRED by 004. Historical rows only. Live data lives in bulk_items (quantity track) and serialized_components (serial track). Do not write here.';


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8. RPC - RECEIVE A SERIALIZED COMPONENT (ATOMIC)
--
-- Replaces the three sequential unguarded inserts in componentService.js, which
-- could leave orphaned rows if insert 2 or 3 failed.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_receive_component(
    p_payload JSONB,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_id     UUID;
    v_serial TEXT;
BEGIN
    v_serial := NULLIF(TRIM(p_payload->>'serial_number'), '');
    IF v_serial IS NULL THEN RAISE EXCEPTION 'Serial number is required'; END IF;
    IF NULLIF(TRIM(p_payload->>'name'), '') IS NULL THEN RAISE EXCEPTION 'Component name is required'; END IF;

    IF EXISTS (SELECT 1 FROM public.serialized_components WHERE serial_number = v_serial) THEN
        RAISE EXCEPTION 'Serial number "%" already exists in inventory', v_serial;
    END IF;

    INSERT INTO public.serialized_components (
        serial_number, part_number, name, category, manufacturer, model, sku,
        status, purchase_cost, currency, vendor_id, po_number, invoice_number,
        purchase_date, warranty_start, warranty_end, current_location, site,
        included_in_asset_cost, notes, received_by, unit
    ) VALUES (
        v_serial,
        NULLIF(p_payload->>'part_number',''),
        p_payload->>'name',
        NULLIF(p_payload->>'category',''),
        NULLIF(p_payload->>'manufacturer',''),
        NULLIF(p_payload->>'model',''),
        NULLIF(p_payload->>'sku',''),
        'AVAILABLE',
        COALESCE((p_payload->>'purchase_cost')::NUMERIC, 0),
        COALESCE(NULLIF(p_payload->>'currency',''), 'INR'),
        NULLIF(p_payload->>'vendor_id','')::UUID,
        NULLIF(p_payload->>'po_number',''),
        NULLIF(p_payload->>'invoice_number',''),
        NULLIF(p_payload->>'purchase_date','')::DATE,
        NULLIF(p_payload->>'warranty_start','')::DATE,
        NULLIF(p_payload->>'warranty_end','')::DATE,
        NULLIF(p_payload->>'current_location',''),
        NULLIF(p_payload->>'site',''),
        COALESCE((p_payload->>'included_in_asset_cost')::BOOLEAN, true),
        NULLIF(p_payload->>'notes',''),
        p_user_id,
        COALESCE(NULLIF(p_payload->>'unit',''), 'nos')
    ) RETURNING id INTO v_id;

    INSERT INTO public.component_lifecycle_events (
        component_id, event_type, new_status, performed_by, location_id, notes, metadata
    ) VALUES (
        v_id, 'RECEIVED', 'AVAILABLE', p_user_id,
        NULLIF(p_payload->>'current_location',''),
        'Goods receipt',
        jsonb_build_object('purchase_cost', COALESCE((p_payload->>'purchase_cost')::NUMERIC, 0),
                           'po_number',     NULLIF(p_payload->>'po_number',''),
                           'invoice_number',NULLIF(p_payload->>'invoice_number',''))
    );

    INSERT INTO public.inventory_transactions (
        component_id, transaction_type, quantity, to_location, site,
        performed_by, unit_cost, total_cost, reference, notes
    ) VALUES (
        v_id, 'receipt', 1,
        NULLIF(p_payload->>'current_location',''),
        NULLIF(p_payload->>'site',''),
        p_user_id,
        COALESCE((p_payload->>'purchase_cost')::NUMERIC, 0),
        COALESCE((p_payload->>'purchase_cost')::NUMERIC, 0),
        NULLIF(p_payload->>'po_number',''),
        'COMPONENT_RECEIPT'
    );

    RETURN jsonb_build_object('success', true, 'id', v_id, 'serial_number', v_serial);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 9. RPC - SCRAP A COMPONENT (REPLACES 003 VERSION)
--
-- Adds scrap value/date/reason persistence to the component row itself so the
-- asset page and the scrap report can read it without walking the event ledger.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_scrap_component(
    p_component_id UUID,
    p_reason       TEXT,
    p_value        NUMERIC,
    p_user_id      UUID
) RETURNS JSONB AS $$
DECLARE
    v_comp RECORD;
BEGIN
    SELECT * INTO v_comp FROM public.serialized_components WHERE id = p_component_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Component not found'; END IF;
    IF v_comp.status = 'SCRAPPED' THEN RAISE EXCEPTION 'Component is already scrapped'; END IF;
    IF v_comp.status = 'INSTALLED' THEN
        RAISE EXCEPTION 'Cannot scrap a component while it is installed in an asset. Remove it first.';
    END IF;

    UPDATE public.serialized_components
       SET status       = 'SCRAPPED',
           scrap_value  = COALESCE(p_value, 0),
           scrap_reason = p_reason,
           scrapped_at  = NOW(),
           updated_at   = NOW()
     WHERE id = p_component_id;

    INSERT INTO public.component_lifecycle_events (
        component_id, event_type, previous_status, new_status, reason,
        disposition, performed_by, metadata
    ) VALUES (
        p_component_id, 'SCRAPPED', v_comp.status, 'SCRAPPED', p_reason,
        'SCRAPPED', p_user_id,
        jsonb_build_object('scrap_value', COALESCE(p_value,0),
                           'purchase_cost', v_comp.purchase_cost,
                           'book_loss', COALESCE(v_comp.purchase_cost,0) - COALESCE(p_value,0))
    );

    INSERT INTO public.inventory_transactions (
        component_id, transaction_type, quantity, performed_by,
        unit_cost, total_cost, notes
    ) VALUES (
        p_component_id, 'scrap', 1, p_user_id,
        v_comp.purchase_cost, COALESCE(p_value,0), 'COMPONENT_SCRAP'
    );

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, entity_name, details)
    VALUES (p_user_id, 'COMPONENT_SCRAPPED', 'component', p_component_id::text, v_comp.name,
            jsonb_build_object('reason', p_reason, 'scrap_value', COALESCE(p_value,0)));

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 10. RPC - REMOVE A COMPONENT (REPLACES 003 VERSION)
--
-- 003 required p_wo_id to be a real work order but the ticket UI was passing a
-- ticket id, which violated the FK and made every install/remove/replace fail.
-- This version accepts EITHER and resolves a ticket id to that ticket's work
-- order, creating one on demand. It also stamps scrap fields when the chosen
-- disposition is SCRAPPED, so removal-and-scrap is a single atomic step.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_resolve_work_order(
    p_id      UUID,       -- may be a work order id, a ticket id, or NULL
    p_user_id UUID
) RETURNS UUID AS $$
DECLARE
    v_wo_id   UUID;
    v_ticket  RECORD;
BEGIN
    IF p_id IS NULL THEN RETURN NULL; END IF;

    -- Already a work order
    SELECT id INTO v_wo_id FROM public.maintenance_work_orders WHERE id = p_id;
    IF v_wo_id IS NOT NULL THEN RETURN v_wo_id; END IF;

    -- A ticket: reuse its newest open work order, else create one
    SELECT * INTO v_ticket FROM public.maintenance_tickets WHERE id = p_id;
    IF NOT FOUND THEN RETURN NULL; END IF;

    SELECT id INTO v_wo_id
      FROM public.maintenance_work_orders
     WHERE ticket_id = p_id AND status NOT IN ('CLOSED','CANCELLED')
     ORDER BY created_at DESC LIMIT 1;

    IF v_wo_id IS NOT NULL THEN RETURN v_wo_id; END IF;

    INSERT INTO public.maintenance_work_orders (
        work_order_number, ticket_id, asset_id, status, priority,
        description, created_by, actual_start
    ) VALUES (
        public.rpc_next_work_order_number(),
        p_id, v_ticket.asset_id, 'IN_PROGRESS',
        COALESCE(v_ticket.priority, 'normal'),
        'Auto-created for parts activity on ticket ' || COALESCE(v_ticket.ticket_no, ''),
        p_user_id, NOW()
    ) RETURNING id INTO v_wo_id;

    RETURN v_wo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.rpc_remove_component(
    p_component_id UUID,
    p_wo_id        UUID,
    p_reason       TEXT,
    p_disposition  TEXT,
    p_user_id      UUID,
    p_new_status   TEXT,
    p_scrap_value  NUMERIC DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
    v_comp   RECORD;
    v_ac     RECORD;
    v_wo     UUID;
    v_status TEXT;
BEGIN
    v_wo := public.fn_resolve_work_order(p_wo_id, p_user_id);

    SELECT * INTO v_comp FROM public.serialized_components WHERE id = p_component_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Component not found'; END IF;
    IF v_comp.status <> 'INSTALLED' THEN
        RAISE EXCEPTION 'Component "%" is %, not INSTALLED, so it cannot be removed.',
                        v_comp.serial_number, v_comp.status;
    END IF;

    SELECT * INTO v_ac FROM public.asset_components
     WHERE component_id = p_component_id AND removed_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'No active installation record found for this component'; END IF;

    v_status := COALESCE(NULLIF(p_new_status,''), 'AVAILABLE');

    UPDATE public.asset_components
       SET removed_at           = NOW(),
           removed_by           = p_user_id,
           remove_work_order_id = v_wo,
           removal_reason       = p_reason,
           disposition          = p_disposition,
           updated_at           = NOW()
     WHERE id = v_ac.id;

    UPDATE public.serialized_components
       SET status          = v_status,
           current_asset_id = NULL,
           current_location = COALESCE(v_comp.current_location, 'MAIN STORE'),
           scrap_value      = CASE WHEN v_status = 'SCRAPPED' THEN COALESCE(p_scrap_value,0) ELSE scrap_value END,
           scrap_reason     = CASE WHEN v_status = 'SCRAPPED' THEN p_reason ELSE scrap_reason END,
           scrapped_at      = CASE WHEN v_status = 'SCRAPPED' THEN NOW() ELSE scrapped_at END,
           updated_at       = NOW()
     WHERE id = p_component_id;

    INSERT INTO public.component_lifecycle_events (
        component_id, event_type, asset_id, work_order_id, previous_status,
        new_status, reason, disposition, performed_by, metadata
    ) VALUES (
        p_component_id, 'REMOVED', v_ac.asset_id, v_wo, v_comp.status,
        v_status, p_reason, p_disposition, p_user_id,
        jsonb_build_object('purchase_cost', v_comp.purchase_cost,
                           'scrap_value',   COALESCE(p_scrap_value,0),
                           'position',      v_ac.position,
                           'days_installed',
                             GREATEST(0, EXTRACT(DAY FROM (NOW() - v_ac.installed_at))::INT))
    );

    IF v_status = 'SCRAPPED' THEN
        INSERT INTO public.component_lifecycle_events (
            component_id, event_type, asset_id, work_order_id, previous_status,
            new_status, reason, disposition, performed_by, metadata
        ) VALUES (
            p_component_id, 'SCRAPPED', v_ac.asset_id, v_wo, 'REMOVED',
            'SCRAPPED', p_reason, 'SCRAPPED', p_user_id,
            jsonb_build_object('scrap_value', COALESCE(p_scrap_value,0),
                               'purchase_cost', v_comp.purchase_cost,
                               'book_loss', COALESCE(v_comp.purchase_cost,0) - COALESCE(p_scrap_value,0))
        );
    END IF;

    INSERT INTO public.inventory_transactions (
        component_id, transaction_type, quantity, from_location, performed_by,
        work_order_id, asset_id, unit_cost, total_cost, notes
    ) VALUES (
        p_component_id,
        CASE WHEN v_status = 'SCRAPPED' THEN 'scrap' ELSE 'return' END,
        1, v_comp.current_location, p_user_id, v_wo, v_ac.asset_id,
        v_comp.purchase_cost, COALESCE(p_scrap_value, 0), 'COMPONENT_REMOVE'
    );

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, entity_name, details)
    VALUES (p_user_id, 'COMPONENT_REMOVED', 'component', p_component_id::text, v_comp.name,
            jsonb_build_object('asset_id', v_ac.asset_id, 'reason', p_reason, 'new_status', v_status));

    RETURN jsonb_build_object('success', true, 'work_order_id', v_wo, 'new_status', v_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 11. RPC - INSTALL A COMPONENT (REPLACES 003 VERSION)
--
-- Same ticket-id tolerance as remove. Also blocks installing a scrapped part
-- and records the cost decision on the event so the asset rollup is auditable.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_install_component(
    p_component_id UUID,
    p_asset_id     UUID,
    p_position     TEXT,
    p_wo_id        UUID,
    p_user_id      UUID,
    p_location     TEXT
) RETURNS JSONB AS $$
DECLARE
    v_comp  RECORD;
    v_asset RECORD;
    v_ac_id UUID;
    v_wo    UUID;
BEGIN
    v_wo := public.fn_resolve_work_order(p_wo_id, p_user_id);

    SELECT * INTO v_comp FROM public.serialized_components WHERE id = p_component_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Component not found'; END IF;

    IF v_comp.status IN ('SCRAPPED','DISPOSED','WRITTEN_OFF','LOST') THEN
        RAISE EXCEPTION 'Component "%" is % and can never be installed again.',
                        v_comp.serial_number, v_comp.status;
    END IF;
    IF v_comp.status = 'INSTALLED' THEN
        RAISE EXCEPTION 'Component "%" is already installed in another asset.', v_comp.serial_number;
    END IF;
    IF v_comp.status NOT IN ('AVAILABLE','RESERVED') THEN
        RAISE EXCEPTION 'Component "%" is % - only AVAILABLE or RESERVED parts can be installed.',
                        v_comp.serial_number, v_comp.status;
    END IF;

    SELECT * INTO v_asset FROM public.assets WHERE id = p_asset_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Asset not found'; END IF;

    UPDATE public.serialized_components
       SET status           = 'INSTALLED',
           current_asset_id = p_asset_id,
           current_location = COALESCE(p_location, v_asset.location, v_asset.site),
           site             = COALESCE(v_asset.site, site),
           updated_at       = NOW()
     WHERE id = p_component_id;

    INSERT INTO public.asset_components (
        asset_id, component_id, position, installed_at, installed_by, install_work_order_id
    ) VALUES (
        p_asset_id, p_component_id, NULLIF(TRIM(COALESCE(p_position,'')),''),
        NOW(), p_user_id, v_wo
    ) RETURNING id INTO v_ac_id;

    INSERT INTO public.component_lifecycle_events (
        component_id, event_type, asset_id, work_order_id, previous_status,
        new_status, performed_by, location_id, metadata
    ) VALUES (
        p_component_id, 'INSTALLED', p_asset_id, v_wo, v_comp.status,
        'INSTALLED', p_user_id, COALESCE(p_location, v_asset.location),
        jsonb_build_object('purchase_cost', v_comp.purchase_cost,
                           'position', p_position,
                           'capitalized', v_comp.included_in_asset_cost,
                           'asset_code', v_asset.asset_code)
    );

    INSERT INTO public.inventory_transactions (
        component_id, transaction_type, quantity, to_location, performed_by,
        work_order_id, asset_id, unit_cost, total_cost, notes
    ) VALUES (
        p_component_id, 'install', 1, COALESCE(p_location, v_asset.location),
        p_user_id, v_wo, p_asset_id,
        v_comp.purchase_cost, v_comp.purchase_cost, 'COMPONENT_INSTALL'
    );

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, entity_name, details)
    VALUES (p_user_id, 'COMPONENT_INSTALLED', 'component', p_component_id::text, v_comp.name,
            jsonb_build_object('asset_id', p_asset_id, 'asset_code', v_asset.asset_code,
                               'position', p_position));

    RETURN jsonb_build_object('success', true, 'asset_component_id', v_ac_id, 'work_order_id', v_wo);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 12. RPC - REPLACE A COMPONENT (REPLACES 003 VERSION)
--
-- This is the headline flow: the failed hard drive comes out and goes to scrap,
-- the new one goes in, and both halves plus the replacement link are written in
-- one transaction so a report can always pair them.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_replace_component(
    p_old_id          UUID,
    p_new_id          UUID,
    p_asset_id        UUID,
    p_position        TEXT,
    p_wo_id           UUID,
    p_reason          TEXT,
    p_disposition     TEXT,
    p_user_id         UUID,
    p_old_new_status  TEXT,
    p_scrap_value     NUMERIC DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
    v_wo       UUID;
    v_position TEXT;
    v_old      RECORD;
    v_new      RECORD;
BEGIN
    IF p_old_id = p_new_id THEN
        RAISE EXCEPTION 'The replacement part must be different from the part being removed.';
    END IF;

    v_wo := public.fn_resolve_work_order(p_wo_id, p_user_id);

    SELECT * INTO v_old FROM public.serialized_components WHERE id = p_old_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Outgoing component not found'; END IF;
    SELECT * INTO v_new FROM public.serialized_components WHERE id = p_new_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Replacement component not found'; END IF;

    -- Keep the slot the old part occupied unless one is supplied
    SELECT COALESCE(NULLIF(TRIM(COALESCE(p_position,'')),''), position)
      INTO v_position
      FROM public.asset_components
     WHERE component_id = p_old_id AND removed_at IS NULL;

    PERFORM public.rpc_remove_component(
        p_old_id, v_wo, p_reason, p_disposition, p_user_id,
        COALESCE(NULLIF(p_old_new_status,''), 'AVAILABLE'), p_scrap_value
    );

    PERFORM public.rpc_install_component(
        p_new_id, p_asset_id, v_position, v_wo, p_user_id, NULL
    );

    INSERT INTO public.component_replacements (
        old_component_id, new_component_id, work_order_id, reason, notes
    ) VALUES (
        p_old_id, p_new_id, v_wo, p_reason,
        format('%s (SN %s) replaced by %s (SN %s)',
               v_old.name, v_old.serial_number, v_new.name, v_new.serial_number)
    );

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, entity_name, details)
    VALUES (p_user_id, 'COMPONENT_REPLACED', 'component', p_old_id::text, v_old.name,
            jsonb_build_object('new_component_id', p_new_id, 'asset_id', p_asset_id,
                               'old_serial', v_old.serial_number, 'new_serial', v_new.serial_number,
                               'old_cost', v_old.purchase_cost, 'new_cost', v_new.purchase_cost,
                               'disposition', p_disposition));

    RETURN jsonb_build_object('success', true, 'work_order_id', v_wo, 'position', v_position);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 13. RPC - CONSUME A BULK PART AGAINST A WORK ORDER
--
-- The bulk-track equivalent of installing a serialized part. Decrements site
-- stock under a row lock, refuses to go negative unless explicitly overridden,
-- and writes to BOTH ledgers so the work order cost and the site stock ledger
-- agree.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_consume_bulk_part(
    p_item_id         UUID,
    p_quantity        NUMERIC,
    p_wo_id           UUID,
    p_user_id         UUID,
    p_site            TEXT DEFAULT NULL,
    p_is_override     BOOLEAN DEFAULT false,
    p_override_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_item      RECORD;
    v_wo        RECORD;
    v_stock     RECORD;
    v_site      TEXT;
    v_unit_cost NUMERIC;
    v_total     NUMERIC;
    v_tx_id     UUID;
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero.';
    END IF;

    SELECT * INTO v_wo FROM public.maintenance_work_orders WHERE id = p_wo_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Work order not found'; END IF;

    SELECT * INTO v_item FROM public.bulk_items WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found'; END IF;

    v_site := COALESCE(NULLIF(TRIM(COALESCE(p_site,'')),''),
                       (SELECT site FROM public.assets WHERE id = v_wo.asset_id),
                       'MAIN STORE');

    SELECT * INTO v_stock FROM public.bulk_site_stock
     WHERE item_id = p_item_id AND site = v_site FOR UPDATE;

    IF NOT FOUND THEN
        IF NOT p_is_override THEN
            RAISE EXCEPTION 'No stock of "%" at site "%". Receive stock first or use override.',
                            v_item.item_name, v_site;
        END IF;
        INSERT INTO public.bulk_site_stock (item_id, site, usable_qty, unit_price)
        VALUES (p_item_id, v_site, 0, COALESCE(v_item.unit_price,0))
        RETURNING * INTO v_stock;
    END IF;

    IF v_stock.usable_qty < p_quantity AND NOT p_is_override THEN
        RAISE EXCEPTION 'Insufficient stock of "%" at "%": % available, % requested.',
                        v_item.item_name, v_site, v_stock.usable_qty, p_quantity;
    END IF;

    IF p_is_override AND NULLIF(TRIM(COALESCE(p_override_reason,'')),'') IS NULL THEN
        RAISE EXCEPTION 'An override reason is required when consuming beyond available stock.';
    END IF;

    v_unit_cost := COALESCE(NULLIF(v_stock.unit_price,0), v_item.unit_price, 0);
    v_total     := v_unit_cost * p_quantity;

    UPDATE public.bulk_site_stock
       SET usable_qty = usable_qty - p_quantity,
           in_use_qty = COALESCE(in_use_qty,0) + p_quantity,
           updated_at = NOW()
     WHERE id = v_stock.id;

    INSERT INTO public.inventory_transactions (
        bulk_item_id, transaction_type, quantity, from_location, site, performed_by,
        work_order_id, ticket_id, asset_id, unit_cost, total_cost,
        is_override, override_reason, reference, notes
    ) VALUES (
        p_item_id, 'consume', p_quantity, v_site, v_site, p_user_id,
        p_wo_id, v_wo.ticket_id, v_wo.asset_id, v_unit_cost, v_total,
        p_is_override, p_override_reason,
        v_wo.work_order_number, 'BULK_PART_CONSUMED'
    ) RETURNING id INTO v_tx_id;

    INSERT INTO public.bulk_transactions (
        item_id, transaction_type, from_site, quantity, total_weight_kg,
        reference, notes, performed_by, work_order_id, ticket_id, asset_id,
        unit_cost, total_cost
    ) VALUES (
        p_item_id, 'consume', v_site, p_quantity,
        COALESCE(v_item.unit_weight_kg,0) * p_quantity,
        v_wo.work_order_number, 'Consumed on maintenance work order',
        p_user_id, p_wo_id, v_wo.ticket_id, v_wo.asset_id, v_unit_cost, v_total
    );

    INSERT INTO public.maintenance_audit_events (entity_type, entity_id, action, actor_id, new_value)
    VALUES ('work_order', p_wo_id, 'part_consumed', p_user_id,
            jsonb_build_object('bulk_item_id', p_item_id, 'item_name', v_item.item_name,
                               'quantity', p_quantity, 'unit_cost', v_unit_cost,
                               'total_cost', v_total, 'site', v_site,
                               'override', p_is_override));

    RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id,
                              'total_cost', v_total, 'unit_cost', v_unit_cost, 'site', v_site);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Reverse a bulk consumption (wrong item, wrong quantity, part came back unused)
CREATE OR REPLACE FUNCTION public.rpc_return_bulk_part(
    p_transaction_id UUID,
    p_user_id        UUID,
    p_reason         TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_tx RECORD;
BEGIN
    SELECT * INTO v_tx FROM public.inventory_transactions
     WHERE id = p_transaction_id AND transaction_type = 'consume' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Consumption transaction not found'; END IF;

    UPDATE public.bulk_site_stock
       SET usable_qty = usable_qty + v_tx.quantity,
           in_use_qty = GREATEST(0, COALESCE(in_use_qty,0) - v_tx.quantity),
           updated_at = NOW()
     WHERE item_id = v_tx.bulk_item_id AND site = COALESCE(v_tx.site, v_tx.from_location);

    INSERT INTO public.inventory_transactions (
        bulk_item_id, transaction_type, quantity, to_location, site, performed_by,
        work_order_id, ticket_id, asset_id, unit_cost, total_cost, reference, notes
    ) VALUES (
        v_tx.bulk_item_id, 'return', v_tx.quantity, v_tx.site, v_tx.site, p_user_id,
        v_tx.work_order_id, v_tx.ticket_id, v_tx.asset_id,
        v_tx.unit_cost, -1 * COALESCE(v_tx.total_cost,0),
        v_tx.reference, COALESCE(p_reason, 'Reversal of consumption ' || p_transaction_id::text)
    );

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Rewire the 002 function so nothing still calls the retired table
CREATE OR REPLACE FUNCTION public.fn_consume_maintenance_part(
    p_item_id         UUID,
    p_quantity        NUMERIC,
    p_work_order_id   UUID,
    p_technician_id   UUID,
    p_is_override     BOOLEAN DEFAULT false,
    p_override_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
BEGIN
    RETURN public.rpc_consume_bulk_part(
        p_item_id, p_quantity, p_work_order_id, p_technician_id,
        NULL, p_is_override, p_override_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 14. RPC - RECEIVE BULK STOCK
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_receive_bulk_stock(
    p_item_id    UUID,
    p_site       TEXT,
    p_quantity   NUMERIC,
    p_unit_price NUMERIC,
    p_user_id    UUID,
    p_reference  TEXT DEFAULT NULL,
    p_notes      TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_site TEXT;
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Received quantity must be greater than zero.';
    END IF;

    SELECT * INTO v_item FROM public.bulk_items WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found'; END IF;

    v_site := COALESCE(NULLIF(TRIM(COALESCE(p_site,'')),''), 'MAIN STORE');

    INSERT INTO public.bulk_site_stock (item_id, site, usable_qty, unit_price)
    VALUES (p_item_id, v_site, p_quantity, COALESCE(p_unit_price, v_item.unit_price, 0))
    ON CONFLICT (item_id, site) DO UPDATE
        SET usable_qty = bulk_site_stock.usable_qty + EXCLUDED.usable_qty,
            unit_price = COALESCE(NULLIF(EXCLUDED.unit_price,0), bulk_site_stock.unit_price),
            updated_at = NOW();

    IF COALESCE(p_unit_price,0) > 0 THEN
        UPDATE public.bulk_items SET unit_price = p_unit_price, updated_at = NOW()
         WHERE id = p_item_id;
    END IF;

    INSERT INTO public.inventory_transactions (
        bulk_item_id, transaction_type, quantity, to_location, site, performed_by,
        unit_cost, total_cost, reference, notes
    ) VALUES (
        p_item_id, 'receipt', p_quantity, v_site, v_site, p_user_id,
        COALESCE(p_unit_price, v_item.unit_price, 0),
        COALESCE(p_unit_price, v_item.unit_price, 0) * p_quantity,
        p_reference, COALESCE(p_notes, 'BULK_RECEIPT')
    );

    INSERT INTO public.bulk_transactions (
        item_id, transaction_type, to_site, quantity, total_weight_kg,
        reference, notes, performed_by, unit_cost, total_cost
    ) VALUES (
        p_item_id, 'receipt', v_site, p_quantity,
        COALESCE(v_item.unit_weight_kg,0) * p_quantity,
        p_reference, p_notes, p_user_id,
        COALESCE(p_unit_price, v_item.unit_price, 0),
        COALESCE(p_unit_price, v_item.unit_price, 0) * p_quantity
    );

    RETURN jsonb_build_object('success', true, 'site', v_site);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 15. RPC - SEQUENTIAL WORK ORDER NUMBER
--
-- WorkOrderFormModal was generating these with Math.random(), which collides and
-- does not sort. The sequence from 002 is now actually used.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.work_order_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.rpc_next_work_order_number()
RETURNS TEXT AS $$
DECLARE
    v_n BIGINT;
BEGIN
    v_n := nextval('public.work_order_number_seq');
    RETURN 'WO-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(v_n::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 16. SLA CONFIG READER
--
-- useMaintenanceOverview.js was querying maintenance_config.config_key /
-- .config_data, neither of which exists, so it silently fell back to hardcoded
-- thresholds on every single load. This returns the real columns, keyed by the
-- priority values the tickets table actually stores (low/normal/high/critical).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_get_sla_config()
RETURNS JSONB AS $$
DECLARE
    v_cfg RECORD;
BEGIN
    SELECT * INTO v_cfg FROM public.maintenance_config ORDER BY created_at LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'low',      jsonb_build_object('hours', 168),
            'normal',   jsonb_build_object('hours', 72),
            'high',     jsonb_build_object('hours', 24),
            'critical', jsonb_build_object('hours', 4),
            'approval_threshold', 500,
            'approval_currency', 'INR'
        );
    END IF;

    RETURN jsonb_build_object(
        'low',      jsonb_build_object('hours', COALESCE(v_cfg.low_sla_hours, 168)),
        'normal',   jsonb_build_object('hours', COALESCE(v_cfg.normal_sla_hours, 72)),
        'high',     jsonb_build_object('hours', COALESCE(v_cfg.high_sla_hours, 24)),
        'critical', jsonb_build_object('hours', COALESCE(v_cfg.critical_sla_hours, 4)),
        'approval_threshold', COALESCE(v_cfg.approval_threshold, 500),
        'approval_currency',  COALESCE(v_cfg.approval_currency, 'INR')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 17. REPORTING VIEWS
-- ─────────────────────────────────────────────────────────────────────────────

-- 17a. WHERE-USED / PART LIFECYCLE
-- One row per installation episode. Answers: "this serial number lived in this
-- laptop from March to August, cost 8000, came out because it failed, and it
-- went to scrap."
CREATE OR REPLACE VIEW public.v_part_where_used AS
SELECT
    ac.id                        AS installation_id,
    sc.id                        AS component_id,
    sc.serial_number,
    sc.part_number,
    sc.name                      AS part_name,
    sc.category                  AS part_category,
    sc.manufacturer,
    sc.model,
    sc.status                    AS current_part_status,
    sc.purchase_cost,
    sc.currency,
    sc.purchase_date,
    sc.po_number,
    sc.invoice_number,
    sc.warranty_end,
    sc.scrap_value,
    sc.scrapped_at,
    sc.scrap_reason,
    sc.included_in_asset_cost,
    v.name                       AS vendor_name,
    a.id                         AS asset_id,
    a.asset_code,
    a.asset_name,
    a.category                   AS asset_category,
    a.site                       AS asset_site,
    a.location                   AS asset_location,
    a.company_code,
    ac.position,
    ac.installed_at,
    ac.removed_at,
    ac.removal_reason,
    ac.disposition,
    (ac.removed_at IS NULL)      AS is_currently_installed,
    CASE WHEN ac.removed_at IS NULL
         THEN EXTRACT(DAY FROM (NOW() - ac.installed_at))::INT
         ELSE EXTRACT(DAY FROM (ac.removed_at - ac.installed_at))::INT
    END                          AS days_installed,
    CASE WHEN sc.status = 'SCRAPPED'
         THEN COALESCE(sc.purchase_cost,0) - COALESCE(sc.scrap_value,0)
         ELSE NULL
    END                          AS book_loss_on_scrap,
    wo_in.work_order_number      AS install_work_order,
    wo_out.work_order_number     AS remove_work_order,
    pi.full_name                 AS installed_by_name,
    pr.full_name                 AS removed_by_name
FROM public.asset_components ac
JOIN public.serialized_components sc ON sc.id = ac.component_id
LEFT JOIN public.assets a           ON a.id  = ac.asset_id
LEFT JOIN public.vendors v          ON v.id  = sc.vendor_id
LEFT JOIN public.maintenance_work_orders wo_in  ON wo_in.id  = ac.install_work_order_id
LEFT JOIN public.maintenance_work_orders wo_out ON wo_out.id = ac.remove_work_order_id
LEFT JOIN public.profiles pi        ON pi.id = ac.installed_by
LEFT JOIN public.profiles pr        ON pr.id = ac.removed_by;


-- 17b. PER-ASSET PARTS COST ROLLUP
-- Splits parts spend into what is still in the machine, what was taken out, and
-- what was scrapped, and separates capitalised from expensed.
CREATE OR REPLACE VIEW public.v_asset_parts_cost AS
WITH serialized AS (
    SELECT
        ac.asset_id,
        COUNT(*) FILTER (WHERE ac.removed_at IS NULL)                                    AS installed_parts_count,
        COUNT(*) FILTER (WHERE ac.removed_at IS NOT NULL)                                AS removed_parts_count,
        COUNT(*) FILTER (WHERE sc.status = 'SCRAPPED')                                   AS scrapped_parts_count,
        COALESCE(SUM(sc.purchase_cost) FILTER (WHERE ac.removed_at IS NULL), 0)          AS installed_parts_value,
        COALESCE(SUM(sc.purchase_cost) FILTER (WHERE ac.removed_at IS NOT NULL), 0)      AS removed_parts_value,
        COALESCE(SUM(sc.purchase_cost) FILTER (WHERE sc.status = 'SCRAPPED'), 0)         AS scrapped_parts_value,
        COALESCE(SUM(sc.scrap_value)   FILTER (WHERE sc.status = 'SCRAPPED'), 0)         AS scrap_recovery_value,
        COALESCE(SUM(sc.purchase_cost) FILTER (WHERE sc.included_in_asset_cost), 0)      AS serialized_capitalized,
        COALESCE(SUM(sc.purchase_cost) FILTER (WHERE NOT sc.included_in_asset_cost), 0)  AS serialized_expensed,
        COALESCE(SUM(sc.purchase_cost), 0)                                               AS serialized_total_spend
    FROM public.asset_components ac
    JOIN public.serialized_components sc ON sc.id = ac.component_id
    GROUP BY ac.asset_id
),
bulk AS (
    SELECT
        it.asset_id,
        COALESCE(SUM(it.total_cost), 0) AS bulk_parts_spend,
        COUNT(*)                        AS bulk_consumption_count
    FROM public.inventory_transactions it
    WHERE it.asset_id IS NOT NULL
      AND it.bulk_item_id IS NOT NULL
      AND it.transaction_type IN ('consume','issue')
    GROUP BY it.asset_id
),
labour AS (
    SELECT
        wo.asset_id,
        COALESCE(SUM(wo.actual_cost), 0)  AS labour_and_other_cost,
        COUNT(*)                          AS work_order_count
    FROM public.maintenance_work_orders wo
    WHERE wo.asset_id IS NOT NULL
    GROUP BY wo.asset_id
)
SELECT
    a.id                                                    AS asset_id,
    COALESCE(s.installed_parts_count, 0)                    AS installed_parts_count,
    COALESCE(s.removed_parts_count, 0)                      AS removed_parts_count,
    COALESCE(s.scrapped_parts_count, 0)                     AS scrapped_parts_count,
    COALESCE(s.installed_parts_value, 0)                    AS installed_parts_value,
    COALESCE(s.removed_parts_value, 0)                      AS removed_parts_value,
    COALESCE(s.scrapped_parts_value, 0)                     AS scrapped_parts_value,
    COALESCE(s.scrap_recovery_value, 0)                     AS scrap_recovery_value,
    COALESCE(s.serialized_capitalized, 0)                   AS serialized_capitalized,
    COALESCE(s.serialized_expensed, 0)                      AS serialized_expensed,
    COALESCE(s.serialized_total_spend, 0)                   AS serialized_total_spend,
    COALESCE(b.bulk_parts_spend, 0)                         AS bulk_parts_spend,
    COALESCE(b.bulk_consumption_count, 0)                   AS bulk_consumption_count,
    COALESCE(l.labour_and_other_cost, 0)                    AS labour_and_other_cost,
    COALESCE(l.work_order_count, 0)                         AS work_order_count,
    COALESCE(s.serialized_total_spend, 0)
      + COALESCE(b.bulk_parts_spend, 0)                     AS total_parts_spend
FROM public.assets a
LEFT JOIN serialized s ON s.asset_id = a.id
LEFT JOIN bulk       b ON b.asset_id = a.id
LEFT JOIN labour     l ON l.asset_id = a.id;


-- 17c. COMBINED ASSET VALUE
-- original_value is left untouched for depreciation continuity. combined_value
-- is original plus capitalised parts, which is what the asset page shows as the
-- headline figure.
CREATE OR REPLACE VIEW public.v_asset_total_cost AS
SELECT
    a.id                                     AS asset_id,
    a.asset_code,
    a.asset_name,
    a.category,
    a.site,
    a.location,
    a.status,
    a.company_code,
    a.purchase_date,
    a.useful_life_years,
    a.depreciation_method,
    a.salvage_value,
    COALESCE(a.purchase_value, 0)            AS original_value,
    pc.serialized_capitalized                AS capitalized_parts,
    pc.serialized_expensed                   AS expensed_parts,
    pc.bulk_parts_spend                      AS consumables_spend,
    pc.total_parts_spend,
    pc.labour_and_other_cost,
    pc.installed_parts_count,
    pc.scrapped_parts_count,
    pc.scrapped_parts_value,
    pc.scrap_recovery_value,
    COALESCE(a.purchase_value, 0) + pc.serialized_capitalized
                                             AS combined_value,
    COALESCE(a.purchase_value, 0) + pc.total_parts_spend
      + pc.labour_and_other_cost             AS total_cost_of_ownership
FROM public.assets a
LEFT JOIN public.v_asset_parts_cost pc ON pc.asset_id = a.id;


-- 17d. WORK ORDER PARTS COST
CREATE OR REPLACE VIEW public.v_work_order_parts AS
SELECT
    it.id                AS transaction_id,
    it.work_order_id,
    wo.work_order_number,
    wo.status            AS work_order_status,
    it.ticket_id,
    it.asset_id,
    a.asset_code,
    a.asset_name,
    it.transaction_type,
    CASE WHEN it.component_id IS NOT NULL THEN 'serialized' ELSE 'bulk' END AS track,
    it.component_id,
    sc.serial_number,
    COALESCE(sc.name, bi.item_name)   AS part_name,
    COALESCE(sc.category, bi.category) AS part_category,
    it.bulk_item_id,
    bi.item_code,
    COALESCE(bi.unit, sc.unit)        AS unit,
    it.quantity,
    it.unit_cost,
    it.total_cost,
    it.site,
    it.is_override,
    it.override_reason,
    it.transaction_at,
    p.full_name          AS performed_by_name
FROM public.inventory_transactions it
LEFT JOIN public.maintenance_work_orders wo ON wo.id = it.work_order_id
LEFT JOIN public.assets a                   ON a.id  = it.asset_id
LEFT JOIN public.serialized_components sc   ON sc.id = it.component_id
LEFT JOIN public.bulk_items bi              ON bi.id = it.bulk_item_id
LEFT JOIN public.profiles p                 ON p.id  = it.performed_by
WHERE it.work_order_id IS NOT NULL;


-- 17e. SCRAPPED PARTS REGISTER
CREATE OR REPLACE VIEW public.v_scrapped_parts AS
SELECT
    sc.id                        AS component_id,
    sc.serial_number,
    sc.part_number,
    sc.name                      AS part_name,
    sc.category,
    sc.manufacturer,
    sc.purchase_date,
    sc.purchase_cost,
    sc.currency,
    sc.po_number,
    sc.invoice_number,
    v.name                       AS vendor_name,
    sc.scrapped_at,
    sc.scrap_value,
    sc.scrap_reason,
    COALESCE(sc.purchase_cost,0) - COALESCE(sc.scrap_value,0) AS book_loss,
    last_use.asset_id            AS last_asset_id,
    last_use.asset_code          AS last_asset_code,
    last_use.asset_name          AS last_asset_name,
    last_use.installed_at        AS last_installed_at,
    last_use.removed_at          AS last_removed_at,
    last_use.days_installed      AS days_in_service,
    last_use.remove_work_order   AS scrapped_on_work_order
FROM public.serialized_components sc
LEFT JOIN public.vendors v ON v.id = sc.vendor_id
LEFT JOIN LATERAL (
    SELECT wu.asset_id, wu.asset_code, wu.asset_name, wu.installed_at,
           wu.removed_at, wu.days_installed, wu.remove_work_order
      FROM public.v_part_where_used wu
     WHERE wu.component_id = sc.id
     ORDER BY wu.installed_at DESC
     LIMIT 1
) last_use ON true
WHERE sc.status IN ('SCRAPPED','DISPOSED','WRITTEN_OFF');


-- 17f. LIVE BULK STOCK WITH REORDER FLAG
-- Replaces the hardcoded "usableQty < 25" magic number in InventoryPage.
CREATE OR REPLACE VIEW public.v_bulk_stock_status AS
SELECT
    bs.id                     AS stock_id,
    bi.id                     AS item_id,
    bi.item_code,
    bi.item_name,
    bi.category,
    bi.part_number,
    bi.manufacturer,
    bi.unit,
    bi.is_spare_part,
    bi.is_active,
    bi.image_url,
    bs.site,
    bs.usable_qty,
    bs.in_use_qty,
    bs.scrap_qty,
    COALESCE(NULLIF(bs.unit_price,0), bi.unit_price, 0)              AS unit_price,
    COALESCE(NULLIF(bs.reorder_level,0), bi.reorder_level, 0)        AS reorder_level,
    COALESCE(NULLIF(bs.unit_price,0), bi.unit_price, 0) * bs.usable_qty AS stock_value,
    CASE
        WHEN bs.usable_qty <= 0 THEN 'OUT_OF_STOCK'
        WHEN COALESCE(NULLIF(bs.reorder_level,0), bi.reorder_level, 0) > 0
             AND bs.usable_qty <= COALESCE(NULLIF(bs.reorder_level,0), bi.reorder_level, 0)
             THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
    END                       AS stock_status,
    bs.location_bin,
    bs.updated_at
FROM public.bulk_site_stock bs
JOIN public.bulk_items bi ON bi.id = bs.item_id;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 18. PERMISSIONS
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT ON public.v_part_where_used      TO authenticated;
GRANT SELECT ON public.v_asset_parts_cost     TO authenticated;
GRANT SELECT ON public.v_asset_total_cost     TO authenticated;
GRANT SELECT ON public.v_work_order_parts     TO authenticated;
GRANT SELECT ON public.v_scrapped_parts       TO authenticated;
GRANT SELECT ON public.v_bulk_stock_status    TO authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_receive_component(JSONB, UUID)                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_install_component(UUID, UUID, TEXT, UUID, UUID, TEXT)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_remove_component(UUID, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_replace_component(UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_scrap_component(UUID, TEXT, NUMERIC, UUID)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_consume_bulk_part(UUID, NUMERIC, UUID, UUID, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_return_bulk_part(UUID, UUID, TEXT)                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_receive_bulk_stock(UUID, TEXT, NUMERIC, NUMERIC, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_next_work_order_number()                                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_sla_config()                                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_resolve_work_order(UUID, UUID)                                     TO authenticated;

-- RLS on the bulk track (it had none)
ALTER TABLE public.bulk_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_site_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bulk_items_read"  ON public.bulk_items;
DROP POLICY IF EXISTS "bulk_items_write" ON public.bulk_items;
CREATE POLICY "bulk_items_read"  ON public.bulk_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "bulk_items_write" ON public.bulk_items FOR ALL
    USING (public.is_admin() OR public.is_moderator())
    WITH CHECK (public.is_admin() OR public.is_moderator());

DROP POLICY IF EXISTS "bulk_stock_read"  ON public.bulk_site_stock;
DROP POLICY IF EXISTS "bulk_stock_write" ON public.bulk_site_stock;
CREATE POLICY "bulk_stock_read"  ON public.bulk_site_stock FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "bulk_stock_write" ON public.bulk_site_stock FOR ALL
    USING (public.is_admin() OR public.is_moderator())
    WITH CHECK (public.is_admin() OR public.is_moderator());

DROP POLICY IF EXISTS "bulk_tx_read"   ON public.bulk_transactions;
DROP POLICY IF EXISTS "bulk_tx_insert" ON public.bulk_transactions;
CREATE POLICY "bulk_tx_read"   ON public.bulk_transactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "bulk_tx_insert" ON public.bulk_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 19. SEED CATEGORIES
--
-- Categories were kept in browser localStorage, so they never synced between
-- users or devices. They now live in the database.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.part_categories (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name        TEXT UNIQUE NOT NULL,
    track       TEXT DEFAULT 'both' CHECK (track IN ('serialized','bulk','both')),
    description TEXT,
    sort_order  INTEGER DEFAULT 100,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.part_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "part_categories_read"  ON public.part_categories;
DROP POLICY IF EXISTS "part_categories_write" ON public.part_categories;
CREATE POLICY "part_categories_read"  ON public.part_categories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "part_categories_write" ON public.part_categories FOR ALL
    USING (public.is_admin() OR public.is_moderator())
    WITH CHECK (public.is_admin() OR public.is_moderator());

GRANT SELECT ON public.part_categories TO authenticated;

INSERT INTO public.part_categories (name, track, sort_order) VALUES
    ('Storage / Hard Drive',  'serialized', 10),
    ('Storage / SSD',         'serialized', 11),
    ('Motherboard',           'serialized', 20),
    ('RAM / Memory',          'serialized', 30),
    ('Processor / CPU',       'serialized', 40),
    ('Graphics Card',         'serialized', 50),
    ('Battery',               'serialized', 60),
    ('Power Adapter',         'serialized', 70),
    ('Display / Screen',      'serialized', 80),
    ('Keyboard',              'serialized', 90),
    ('Cooling Fan',           'serialized', 100),
    ('Network Card',          'serialized', 110),
    ('Motor',                 'serialized', 120),
    ('Pump',                  'serialized', 130),
    ('Tyre / Tire',           'serialized', 140),
    ('Cable / Wiring',        'bulk',       200),
    ('Thermal Paste',         'bulk',       210),
    ('Screws / Fasteners',    'bulk',       220),
    ('Lubricant / Oil',       'bulk',       230),
    ('Filter',                'bulk',       240),
    ('Cleaning Supplies',     'bulk',       250),
    ('Consumable / Other',    'bulk',       260)
ON CONFLICT (name) DO NOTHING;

-- Adopt any categories already in use so nothing disappears from the filters
INSERT INTO public.part_categories (name, track, sort_order)
SELECT DISTINCT category, 'serialized', 500 FROM public.serialized_components
 WHERE category IS NOT NULL AND TRIM(category) <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.part_categories (name, track, sort_order)
SELECT DISTINCT category, 'bulk', 500 FROM public.bulk_items
 WHERE category IS NOT NULL AND TRIM(category) <> ''
ON CONFLICT (name) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 20. BACKFILL asset_components.install_work_order_id INTEGRITY CHECK
--
-- Reports any legacy rows whose work order reference is dangling, rather than
-- failing the migration.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE v_bad INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_bad
      FROM public.asset_components ac
     WHERE (ac.install_work_order_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM public.maintenance_work_orders w WHERE w.id = ac.install_work_order_id))
        OR (ac.remove_work_order_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM public.maintenance_work_orders w WHERE w.id = ac.remove_work_order_id));
    IF v_bad > 0 THEN
        RAISE NOTICE '% asset_components rows have a dangling work order reference.', v_bad;
    END IF;
END $$;

COMMIT;


-- ═══════════════════════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION  (run separately, read-only)
-- ═══════════════════════════════════════════════════════════════════════════════
-- SELECT 'bulk_items'            AS t, COUNT(*) FROM public.bulk_items
-- UNION ALL SELECT 'migrated from inventory_items', COUNT(*) FROM public.bulk_items WHERE migrated_from_inventory_item_id IS NOT NULL
-- UNION ALL SELECT 'bulk_site_stock',      COUNT(*) FROM public.bulk_site_stock
-- UNION ALL SELECT 'serialized_components',COUNT(*) FROM public.serialized_components
-- UNION ALL SELECT 'asset_components',     COUNT(*) FROM public.asset_components
-- UNION ALL SELECT 'archive rows',         COUNT(*) FROM public.inventory_items_archive
-- UNION ALL SELECT 'part_categories',      COUNT(*) FROM public.part_categories;
--
-- SELECT * FROM public.v_asset_total_cost WHERE total_parts_spend > 0 ORDER BY total_parts_spend DESC LIMIT 20;
-- SELECT * FROM public.v_part_where_used ORDER BY installed_at DESC LIMIT 20;
-- SELECT * FROM public.v_scrapped_parts ORDER BY scrapped_at DESC LIMIT 20;
-- SELECT public.fn_get_sla_config();


-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK  (only if you must go back; no data is lost either way)
-- ═══════════════════════════════════════════════════════════════════════════════
-- BEGIN;
--   ALTER TABLE public.inventory_items_archive RENAME TO inventory_items;
--   DROP VIEW IF EXISTS public.v_bulk_stock_status, public.v_scrapped_parts,
--                       public.v_work_order_parts, public.v_asset_total_cost,
--                       public.v_asset_parts_cost, public.v_part_where_used;
--   DELETE FROM public.bulk_site_stock
--    WHERE item_id IN (SELECT id FROM public.bulk_items WHERE migrated_from_inventory_item_id IS NOT NULL);
--   DELETE FROM public.bulk_items WHERE migrated_from_inventory_item_id IS NOT NULL;
-- COMMIT;
