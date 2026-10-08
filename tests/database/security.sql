\set ON_ERROR_STOP on
-- Disposable database only. IDs are fixed synthetic fixtures.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('00000000-0000-0000-0000-000000000001','admin@test.invalid','{}'),
 ('00000000-0000-0000-0000-000000000002','field@test.invalid','{}'),
 ('00000000-0000-0000-0000-000000000003','other@test.invalid','{}'),
 ('00000000-0000-0000-0000-000000000004','attacker@test.invalid','{"role":"admin"}');
UPDATE public.profiles SET role='admin' WHERE id='00000000-0000-0000-0000-000000000001';
INSERT INTO public.user_company_assignments VALUES
 ('00000000-0000-0000-0000-000000000001','A'),
 ('00000000-0000-0000-0000-000000000002','A'),
 ('00000000-0000-0000-0000-000000000003','B');
INSERT INTO public.user_site_assignments(user_id,site_name) VALUES('00000000-0000-0000-0000-000000000002','Yard');
INSERT INTO public.assets(id,asset_code,asset_name,company_code,site,purchase_value) VALUES
 ('10000000-0000-0000-0000-000000000001','A-001','Excavator','A','Yard',50000),
 ('10000000-0000-0000-0000-000000000002','A-002','Crane','A','Other site',60000),
 ('10000000-0000-0000-0000-000000000003','B-001','Truck','B','Yard',70000);
INSERT INTO public.asset_photos(asset_id,photo_url) VALUES
 ('10000000-0000-0000-0000-000000000001','https://example.invalid/photo'),
 ('10000000-0000-0000-0000-000000000003','https://example.invalid/private');
-- Deliberately broad legacy policy must not bypass the new restrictive scope.
CREATE POLICY fixture_legacy_photos ON public.asset_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);
DO $$ BEGIN
 IF (SELECT role FROM public.profiles WHERE email='attacker@test.invalid') <> 'user' THEN RAISE EXCEPTION 'Signup privilege escalation'; END IF;
END $$;

SET ROLE anon;
DO $$ DECLARE result jsonb; BEGIN
 BEGIN PERFORM * FROM public.profiles; RAISE EXCEPTION 'Anonymous profiles exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.assets; RAISE EXCEPTION 'Anonymous assets exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 result := public.get_public_asset('10000000-0000-0000-0000-000000000001');
 IF result->>'asset_code' <> 'A-001' OR result ? 'purchase_value' OR result ? 'site' THEN RAISE EXCEPTION 'Unsafe QR projection'; END IF;
 BEGIN PERFORM public.archive_assets(ARRAY['10000000-0000-0000-0000-000000000001'::uuid]); RAISE EXCEPTION 'Anonymous archive'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.assets) <> 1 THEN RAISE EXCEPTION 'Site isolation failed'; END IF;
 IF (SELECT count(*) FROM public.asset_photos) <> 1 THEN RAISE EXCEPTION 'Child scope failed'; END IF;
 BEGIN UPDATE public.profiles SET role='admin' WHERE id=auth.uid(); RAISE EXCEPTION 'Self role escalation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.profiles SET is_active=false WHERE id=auth.uid(); RAISE EXCEPTION 'Self security mutation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.profiles SET full_name='Updated name' WHERE id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Own contact update denied'; END IF;
 BEGIN PERFORM public.archive_assets(ARRAY['10000000-0000-0000-0000-000000000001'::uuid]); RAISE EXCEPTION 'Field user archive'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.assets) <> 2 THEN RAISE EXCEPTION 'Admin company isolation failed'; END IF;
 BEGIN PERFORM public.archive_assets(ARRAY['10000000-0000-0000-0000-000000000001'::uuid,'10000000-0000-0000-0000-000000000003'::uuid]); RAISE EXCEPTION 'Cross-company archive allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT count(*) FROM public.assets) <> 2 THEN RAISE EXCEPTION 'Partial archive committed'; END IF;
 PERFORM public.archive_assets(ARRAY['10000000-0000-0000-0000-000000000001'::uuid]);
 IF (SELECT count(*) FROM public.assets) <> 1 THEN RAISE EXCEPTION 'Archive still visible'; END IF;
 IF public.get_public_asset('10000000-0000-0000-0000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'Archived QR still public'; END IF;
 IF (SELECT count(*) FROM public.list_archived_assets()) <> 1 THEN RAISE EXCEPTION 'Archive list missing'; END IF;
 PERFORM public.restore_archived_asset('10000000-0000-0000-0000-000000000001');
 IF (SELECT count(*) FROM public.assets) <> 2 THEN RAISE EXCEPTION 'Restore failed'; END IF;
 IF (SELECT count(*) FROM public.asset_photos) <> 1 THEN RAISE EXCEPTION 'Restored photo missing'; END IF;
 BEGIN DELETE FROM public.assets WHERE asset_code='A-001'; RAISE EXCEPTION 'Hard delete allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.profiles SET is_active=false WHERE id='00000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.assets) <> 0 THEN RAISE EXCEPTION 'Inactive account access'; END IF;
 BEGIN PERFORM public.archive_assets(ARRAY['10000000-0000-0000-0000-000000000001'::uuid]); RAISE EXCEPTION 'Inactive account RPC'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'PASS: signup, profile escalation, anon, company/site/child isolation, atomic archive/restore, inactive users' AS result;
