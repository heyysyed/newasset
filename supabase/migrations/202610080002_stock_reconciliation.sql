BEGIN;
ALTER TABLE public.bulk_items ADD COLUMN IF NOT EXISTS company_code text;
CREATE TABLE IF NOT EXISTS public.stock_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  action_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.bulk_items(id),
  site text NOT NULL,
  request jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(actor_id,action_id)
);
ALTER TABLE public.stock_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stock_reconciliations FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.reconcile_bulk_stock(
  p_action_id uuid, p_item_id uuid, p_site text, p_expected numeric, p_physical numeric, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item public.bulk_items; stock public.bulk_site_stock; previous public.stock_reconciliations;
  request jsonb; result jsonb; variance numeric;
BEGIN
  IF NOT (public.app_permission('access_inventory') OR public.app_permission('access_audit')) THEN
    RAISE EXCEPTION 'Inventory or audit permission required' USING ERRCODE='42501';
  END IF;
  IF p_action_id IS NULL OR p_physical IS NULL OR p_expected IS NULL OR p_physical < 0 OR p_expected < 0
    OR p_physical::text IN ('NaN','Infinity','-Infinity') OR p_expected::text IN ('NaN','Infinity','-Infinity')
    OR coalesce(length(trim(p_reason)),0) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Enter valid quantities and a reconciliation reason'; END IF;
  SELECT * INTO item FROM public.bulk_items WHERE id=p_item_id;
  IF NOT FOUND OR NOT coalesce(public.app_asset_scope(item.company_code,p_site,NULL),false) THEN
    RAISE EXCEPTION 'Stock not accessible' USING ERRCODE='42501';
  END IF;
  request := jsonb_build_object('item',p_item_id,'site',p_site,'expected',p_expected,'physical',p_physical,'reason',p_reason);
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_action_id::text,0));
  SELECT * INTO previous FROM public.stock_reconciliations WHERE actor_id=auth.uid() AND action_id=p_action_id;
  IF FOUND THEN
    IF previous.request <> request THEN RAISE EXCEPTION 'Action ID was reused for different work'; END IF;
    RETURN previous.result;
  END IF;
  SELECT * INTO stock FROM public.bulk_site_stock WHERE item_id=p_item_id AND site=p_site FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock record not found'; END IF;
  IF stock.usable_qty IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Stock changed since this count. Reload and review before retrying.' USING ERRCODE='40001'; END IF;
  variance := p_physical-stock.usable_qty;
  result := jsonb_build_object('variance',variance,'variancePct',CASE WHEN stock.usable_qty>0 THEN abs(variance/stock.usable_qty)*100 WHEN p_physical>0 THEN 100 ELSE 0 END);
  result := result || jsonb_build_object('isHighRisk',(result->>'variancePct')::numeric>10);
  UPDATE public.bulk_site_stock SET usable_qty=p_physical WHERE id=stock.id;
  INSERT INTO public.stock_reconciliations(actor_id,action_id,item_id,site,request,result)
    VALUES(auth.uid(),p_action_id,p_item_id,p_site,request,result);
  INSERT INTO public.security_events(actor_id,action,entity_id,details)
    VALUES(auth.uid(),'stock_reconciled',p_item_id,request||result);
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.reconcile_bulk_stock(uuid,uuid,text,numeric,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reconcile_bulk_stock(uuid,uuid,text,numeric,numeric,text) TO authenticated;

-- Enforce new writes without rewriting potentially inconsistent historical data.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.bulk_site_stock'::regclass AND conname='stock_nonnegative') THEN
    ALTER TABLE public.bulk_site_stock ADD CONSTRAINT stock_nonnegative CHECK (
      usable_qty >= 0 AND in_use_qty >= 0 AND scrap_qty >= 0 AND
      usable_qty::text NOT IN ('NaN','Infinity') AND in_use_qty::text NOT IN ('NaN','Infinity') AND scrap_qty::text NOT IN ('NaN','Infinity')
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass AND conname='inventory_nonnegative') THEN
    ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_nonnegative CHECK (current_stock >= 0 AND current_stock::text NOT IN ('NaN','Infinity')) NOT VALID;
  END IF;
END $$;
COMMIT;
