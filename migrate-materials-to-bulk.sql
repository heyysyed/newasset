-- ==============================================================================
-- MIGRATION SCRIPT: Move 'materials' and 'material_stock' to 'bulk' system
-- ==============================================================================

DO $$
DECLARE
  mat_row RECORD;
  stk_row RECORD;
  slip_row RECORD;
  v_item_id UUID;
  v_stock_id UUID;
BEGIN
  -- Create new table for Issue Slips to link to bulk_items instead of materials
  CREATE TABLE IF NOT EXISTS public.inventory_issue_slips (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slip_no TEXT UNIQUE NOT NULL,
      item_id UUID REFERENCES public.bulk_items(id) ON DELETE CASCADE,
      site TEXT NOT NULL,
      quantity NUMERIC NOT NULL,
      issued_to TEXT NOT NULL,
      issued_to_role TEXT,
      purpose TEXT,
      notes TEXT,
      issued_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      company_code TEXT
  );

  -- 1. Iterate through all materials
  FOR mat_row IN 
    SELECT * FROM public.materials
  LOOP
    
    -- Step 1: Find or Create Master Item in bulk_items
    SELECT id INTO v_item_id 
    FROM public.bulk_items 
    WHERE item_code = mat_row.material_code OR item_name = mat_row.material_name
    LIMIT 1;
    
    IF v_item_id IS NULL THEN
      INSERT INTO public.bulk_items (
        item_code, 
        item_name, 
        category, 
        unit,
        unit_weight_kg,
        is_active
      )
      VALUES (
        COALESCE(mat_row.material_code, 'MAT-' || substr(md5(random()::text), 1, 6)),
        mat_row.material_name,
        mat_row.category,
        COALESCE(mat_row.unit, 'nos'),
        0, -- default weight
        true
      ) RETURNING id INTO v_item_id;
    END IF;

    -- 2. Iterate through stock for this material
    FOR stk_row IN
      SELECT * FROM public.material_site_stock WHERE material_id = mat_row.id
    LOOP
      IF stk_row.site IS NOT NULL AND stk_row.quantity > 0 THEN
        
        SELECT id INTO v_stock_id 
        FROM public.bulk_site_stock 
        WHERE item_id = v_item_id AND site = stk_row.site 
        LIMIT 1;

        IF v_stock_id IS NOT NULL THEN
          -- Add to existing stock
          UPDATE public.bulk_site_stock 
          SET usable_qty = usable_qty + stk_row.quantity,
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
            stk_row.site, 
            stk_row.quantity, 
            0, 
            0
          );
        END IF;
      END IF;
    END LOOP;

    -- 3. Migrate Issue Slips for this material
    -- We assume the old table is 'material_issue_slips'
    FOR slip_row IN 
      SELECT * FROM public.material_issue_slips WHERE material_id = mat_row.id
    LOOP
      INSERT INTO public.inventory_issue_slips (
        slip_no, item_id, site, quantity, issued_to, issued_to_role, purpose, notes, issued_by, created_at, company_code
      ) VALUES (
        slip_row.slip_no, v_item_id, slip_row.site, slip_row.quantity, slip_row.issued_to, slip_row.issued_to_role, slip_row.purpose, slip_row.notes, slip_row.issued_by, slip_row.created_at, slip_row.company_code
      ) ON CONFLICT (slip_no) DO NOTHING;
    END LOOP;
    
  END LOOP;
END $$;
