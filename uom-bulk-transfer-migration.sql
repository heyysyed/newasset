-- ============================================================
-- Migration: UoM + Bulk / Partial Quantity Transfers
-- ============================================================

-- 1. Add uom (Unit of Measurement) column to assets
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS uom TEXT DEFAULT 'nos';

-- 2. Add asset_type column: 'serialized' (qty=1, gets QR) or 'bulk' (qty>1, no QR)
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS asset_type TEXT DEFAULT 'serialized'
  CHECK (asset_type IN ('serialized', 'bulk'));

-- 3. RPC: Atomic bulk transfer — splits a bulk asset across sites
--    Decrements source asset quantity and creates/increments a matching asset at destination.
CREATE OR REPLACE FUNCTION public.bulk_transfer_asset(
  p_source_asset_id UUID,
  p_transfer_qty    NUMERIC,
  p_to_site         TEXT,
  p_user_id         UUID,
  p_notes           TEXT DEFAULT NULL
)
RETURNS UUID  -- returns the destination asset ID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source       RECORD;
  v_dest_id      UUID;
  v_remaining    NUMERIC;
BEGIN
  -- Lock the source row to prevent concurrent transfers
  SELECT * INTO v_source
    FROM public.assets
   WHERE id = p_source_asset_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source asset not found';
  END IF;

  IF v_source.quantity < p_transfer_qty THEN
    RAISE EXCEPTION 'Insufficient quantity: have %, requested %', v_source.quantity, p_transfer_qty;
  END IF;

  IF p_transfer_qty <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be positive';
  END IF;

  v_remaining := v_source.quantity - p_transfer_qty;

  -- Decrement source
  UPDATE public.assets
     SET quantity   = v_remaining,
         updated_at = NOW()
   WHERE id = p_source_asset_id;

  -- Check if a matching bulk asset already exists at destination site
  SELECT id INTO v_dest_id
    FROM public.assets
   WHERE asset_name   = v_source.asset_name
     AND category     = v_source.category
     AND site         = p_to_site
     AND asset_type   = 'bulk'
     AND COALESCE(make, '')     = COALESCE(v_source.make, '')
     AND COALESCE(model_no, '') = COALESCE(v_source.model_no, '')
     AND company_code = v_source.company_code
   LIMIT 1
     FOR UPDATE;

  IF v_dest_id IS NOT NULL THEN
    -- Increment existing destination asset
    UPDATE public.assets
       SET quantity   = quantity + p_transfer_qty,
           updated_at = NOW()
     WHERE id = v_dest_id;
  ELSE
    -- Create new asset at destination (clone source minus qty-specific fields)
    INSERT INTO public.assets (
      asset_code, asset_name, make, model_no, serial_no, capacity,
      purchase_order_no, status, category, site, type_code, department,
      quantity, uom, asset_type, company_code,
      purchase_value, salvage_value, useful_life_years,
      depreciation_method, depreciation_rate_percent,
      added_by, added_on, updated_at, notes
    )
    VALUES (
      v_source.asset_code || '/SPLIT',  -- temporary code, app should regenerate
      v_source.asset_name, v_source.make, v_source.model_no, NULL, v_source.capacity,
      v_source.purchase_order_no, v_source.status, v_source.category, p_to_site,
      v_source.type_code, v_source.department,
      p_transfer_qty, v_source.uom, 'bulk', v_source.company_code,
      v_source.purchase_value, v_source.salvage_value, v_source.useful_life_years,
      v_source.depreciation_method, v_source.depreciation_rate_percent,
      p_user_id, NOW(), NOW(),
      'Split from ' || v_source.asset_code || ' via bulk transfer'
    )
    RETURNING id INTO v_dest_id;
  END IF;

  -- Log movement for source
  INSERT INTO public.asset_movements (asset_id, moved_by, movement_type, from_location, to_location, notes)
  VALUES (p_source_asset_id, p_user_id, 'transfer', v_source.site, p_to_site,
          COALESCE(p_notes, '') || ' | Qty: ' || p_transfer_qty || ' ' || COALESCE(v_source.uom, 'nos'));

  -- Log audit
  INSERT INTO public.asset_audit (asset_id, user_id, action, changes)
  VALUES (p_source_asset_id, p_user_id, 'bulk_transfer', jsonb_build_object(
    'from_site', v_source.site, 'to_site', p_to_site,
    'qty_transferred', p_transfer_qty, 'qty_remaining', v_remaining,
    'dest_asset_id', v_dest_id
  ));

  -- If source quantity is now 0, optionally mark as disposed/inactive
  IF v_remaining = 0 THEN
    UPDATE public.assets SET status = 'Inactive', updated_at = NOW() WHERE id = p_source_asset_id;
  END IF;

  RETURN v_dest_id;
END;
$$;
