UPDATE public.profiles SET is_active=true WHERE id='00000000-0000-0000-0000-000000000001';
INSERT INTO public.bulk_items(id,item_code,item_name,company_code) VALUES('20000000-0000-0000-0000-000000000001','BULK1','Pipes','A');
INSERT INTO public.bulk_site_stock(item_id,site,usable_qty) VALUES('20000000-0000-0000-0000-000000000001','Yard',10);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
DO $$ DECLARE first_result jsonb; duplicate_result jsonb; BEGIN
 first_result:=public.reconcile_bulk_stock('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Yard',10,8,'Physical count');
 duplicate_result:=public.reconcile_bulk_stock('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Yard',10,8,'Physical count');
 IF first_result IS DISTINCT FROM duplicate_result OR (first_result->>'variance')::numeric<>-2 THEN RAISE EXCEPTION 'Idempotence failed'; END IF;
 BEGIN PERFORM public.reconcile_bulk_stock('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Yard',10,7,'Stale count'); RAISE EXCEPTION 'Stale count accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
DO $$ BEGIN
 BEGIN PERFORM public.reconcile_bulk_stock('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','Yard',8,4,'Cross company'); RAISE EXCEPTION 'Cross company reconciliation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT usable_qty FROM public.bulk_site_stock WHERE item_id='20000000-0000-0000-0000-000000000001')<>8 THEN RAISE EXCEPTION 'Incorrect final stock'; END IF;
 IF (SELECT count(*) FROM public.stock_reconciliations)<>1 THEN RAISE EXCEPTION 'Duplicate reconciliation'; END IF;
 BEGIN UPDATE public.bulk_site_stock SET usable_qty=-1; RAISE EXCEPTION 'Negative stock accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SELECT 'PASS: atomic stock adjustment, retry idempotence, stale-count conflicts, negative-stock constraint' AS result;
