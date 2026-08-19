-- ==============================================================================
-- REVERT SCRIPT: Move mistakenly migrated assets back to the normal Assets table
-- ==============================================================================
-- This script targets assets that were migrated because they had quantity > 1,
-- but belong to non-bulk categories like 'Furniture & Fixtures', 'Plant & Machinery', etc.

DO $$
DECLARE
  asset_row RECORD;
  v_item_id UUID;
  v_original_qty NUMERIC;
BEGIN
  -- Iterate through assets that were migrated but shouldn't have been
  FOR asset_row IN 
    SELECT * FROM public.assets 
    WHERE notes ILIKE '%[Migrated to Bulk Module]%'
      AND category NOT IN ('Scaffolding', 'Structural Materials', 'Bulk Items', 'Pipes', 'Plates')
  LOOP
    
    -- 1. Find the corresponding bulk_item
    SELECT id INTO v_item_id 
    FROM public.bulk_items 
    WHERE item_code = asset_row.asset_code 
    LIMIT 1;
    
    v_original_qty := 1;

    IF v_item_id IS NOT NULL THEN
      -- Get the original quantity from the migration transaction
      SELECT quantity INTO v_original_qty 
      FROM public.bulk_transactions 
      WHERE item_id = v_item_id AND notes = 'Migrated from legacy assets table' 
      LIMIT 1;

      IF v_original_qty IS NULL THEN
        v_original_qty := 1;
      END IF;

      -- Delete stock and transactions
      DELETE FROM public.bulk_site_stock WHERE item_id = v_item_id;
      DELETE FROM public.bulk_transactions WHERE item_id = v_item_id;
      -- Delete the master item
      DELETE FROM public.bulk_items WHERE id = v_item_id;
    END IF;

    -- 2. Restore the asset record
    UPDATE public.assets 
    SET status = 'Active', 
        quantity = v_original_qty, 
        notes = BTRIM(REPLACE(notes, '| [Migrated to Bulk Module]', ''))
    WHERE id = asset_row.id;
    
  END LOOP;
END $$;
