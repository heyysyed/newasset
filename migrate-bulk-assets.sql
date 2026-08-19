-- ==============================================================================
-- MIGRATION SCRIPT: Move bulk/multiple-quantity assets to the new Bulk system
-- ==============================================================================
-- This script will:
-- 1. Find all records in the `assets` table where `quantity > 1` or `asset_type = 'bulk'`.
-- 2. Create master item records in `bulk_items` if they don't exist.
-- 3. Add the quantities to the `bulk_site_stock` table for the respective sites.
-- 4. Create an initial 'receipt' transaction in `bulk_transactions` for audit.
-- 5. Delete the migrated records from the `assets` table to prevent duplicates.
-- ==============================================================================

DO $$
DECLARE
  asset_row RECORD;
  v_item_id UUID;
  v_stock_id UUID;
BEGIN
  -- Iterate through all assets that are considered 'bulk' or have multiple quantity
  FOR asset_row IN 
    SELECT * FROM public.assets 
    WHERE quantity > 1 
       OR asset_type = 'bulk' 
       OR category IN ('Scaffolding', 'Structural Materials', 'Bulk Items', 'Pipes', 'Plates')
  LOOP
    
    -- Step 1: Find or Create Master Item in bulk_items
    SELECT id INTO v_item_id 
    FROM public.bulk_items 
    WHERE item_code = asset_row.asset_code OR item_name = asset_row.asset_name
    LIMIT 1;
    
    IF v_item_id IS NULL THEN
      INSERT INTO public.bulk_items (
        item_code, 
        item_name, 
        category, 
        unit, 
        is_active
      )
      VALUES (
        COALESCE(asset_row.asset_code, 'BULK-' || substr(md5(random()::text), 1, 6)),
        COALESCE(asset_row.asset_name, 'Unknown Bulk Item'),
        asset_row.category,
        COALESCE(asset_row.uom, 'nos'),
        true
      ) RETURNING id INTO v_item_id;
    END IF;

    -- Step 2: Update or Insert into bulk_site_stock
    IF asset_row.site IS NOT NULL THEN
      
      SELECT id INTO v_stock_id 
      FROM public.bulk_site_stock 
      WHERE item_id = v_item_id AND site = asset_row.site 
      LIMIT 1;

      IF v_stock_id IS NOT NULL THEN
        -- Add to existing stock
        UPDATE public.bulk_site_stock 
        SET usable_qty = usable_qty + COALESCE(asset_row.quantity, 1),
            updated_at = NOW()
        WHERE id = v_stock_id;
      ELSE
        -- Create new stock entry
        INSERT INTO public.bulk_site_stock (
          item_id, 
          site, 
          usable_qty, 
          in_use_qty, 
          scrap_qty
        )
        VALUES (
          v_item_id, 
          asset_row.site, 
          COALESCE(asset_row.quantity, 1), 
          0, 
          0
        );
      END IF;
      
      -- Step 3: Create an audit trail transaction
      INSERT INTO public.bulk_transactions (
        item_id, 
        transaction_type, 
        to_site, 
        quantity, 
        notes, 
        performed_by
      )
      VALUES (
        v_item_id, 
        'receipt', 
        asset_row.site, 
        COALESCE(asset_row.quantity, 1), 
        'Migrated from legacy assets table', 
        asset_row.added_by
      );

    END IF;

    -- Step 4: Deactivate the migrated asset instead of deleting to preserve foreign key history
    UPDATE public.assets 
    SET status = 'Inactive', 
        quantity = 0, 
        notes = COALESCE(notes, '') || ' | [Migrated to Bulk Module]'
    WHERE id = asset_row.id;
    
  END LOOP;
END $$;
