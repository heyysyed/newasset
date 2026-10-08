-- Apply to a restored staging project first. Existing schema must be inventoried.
-- Company memberships must be provisioned by a trusted operator before rollout.
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_company_assignments (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_code text NOT NULL CHECK (length(trim(company_code)) > 0),
  PRIMARY KEY (user_id, company_code)
);
CREATE TABLE IF NOT EXISTS public.user_site_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_name text NOT NULL,
  UNIQUE (user_id, site_name)
);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS company_code text;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS record_version integer DEFAULT 1;
CREATE INDEX IF NOT EXISTS assets_active_scope_idx ON public.assets(company_code, site) WHERE archived_at IS NULL;
CREATE TABLE IF NOT EXISTS public.security_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.app_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active IS TRUE
$$;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(public.app_role() IN ('admin','super_admin'), false)
$$;
CREATE OR REPLACE FUNCTION public.is_moderator() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(public.app_role() IN ('admin','super_admin','moderator'), false)
$$;
CREATE OR REPLACE FUNCTION public.app_has_company(code text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.app_role() IS NOT NULL AND (
    public.app_role() = 'super_admin' OR EXISTS (
      SELECT 1 FROM public.user_company_assignments WHERE user_id = auth.uid() AND company_code = code
    )
  )
$$;
CREATE OR REPLACE FUNCTION public.app_asset_scope(code text, site_name text, assignee uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.app_has_company(code) AND (
    public.is_admin() OR assignee = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user_site_assignments s WHERE s.user_id = auth.uid() AND s.site_name = $2
    )
  )
$$;
CREATE OR REPLACE FUNCTION public.app_permission(action text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(public.is_admin() OR (
    public.app_role() = 'moderator' AND (
      SELECT moderator_permissions ->> ('can_' || action) = 'true' FROM public.app_settings WHERE id = 1
    )
  ), false)
$$;
CREATE OR REPLACE FUNCTION public.app_shared_company(other_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.app_role() IS NOT NULL AND (public.app_role() = 'super_admin' OR EXISTS (
    SELECT 1 FROM public.user_company_assignments mine
    JOIN public.user_company_assignments theirs USING (company_code)
    WHERE mine.user_id = auth.uid() AND theirs.user_id = other_id
  ))
$$;

-- Signup metadata is user-controlled. It must never select the account role.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(id,email,full_name,role)
  VALUES (NEW.id, NEW.email, coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.app_protect_profile() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- SQL maintenance/auth provisioning with no end-user identity is trusted.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT public.is_admin() THEN
    IF (to_jsonb(NEW) - ARRAY['full_name','phone','photo_url','signature_url','updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['full_name','phone','photo_url','signature_url','updated_at']) THEN
      RAISE EXCEPTION 'Only personal contact details can be edited' USING ERRCODE = '42501';
    END IF;
  ELSIF public.app_role() <> 'super_admin' AND
    (NEW.role = 'super_admin' OR OLD.role = 'super_admin') THEN
    RAISE EXCEPTION 'Super administrator changes require a super administrator' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS app_protect_profile ON public.profiles;
CREATE TRIGGER app_protect_profile BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.app_protect_profile();

-- Remove ALL policies on these tables: permissive policies combine with OR.
DO $$ DECLARE p record; t text; BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','assets','app_settings','user_site_assignments','user_company_assignments','security_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
  USING (public.app_role() IS NOT NULL AND (id=auth.uid() OR public.app_shared_company(id)));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (public.app_role() IS NOT NULL AND (id=auth.uid() OR (public.is_admin() AND public.app_shared_company(id))))
  WITH CHECK (public.app_role() IS NOT NULL AND (id=auth.uid() OR (public.is_admin() AND public.app_shared_company(id))));
CREATE POLICY companies_read ON public.user_company_assignments FOR SELECT TO authenticated
  USING (public.app_role() IS NOT NULL AND (user_id=auth.uid() OR public.app_role()='super_admin'));
CREATE POLICY sites_read ON public.user_site_assignments FOR SELECT TO authenticated
  USING (public.app_role() IS NOT NULL AND (user_id=auth.uid() OR (public.is_admin() AND public.app_shared_company(user_id))));
-- Membership writes are deliberately reserved for trusted provisioning.
CREATE POLICY settings_read ON public.app_settings FOR SELECT TO authenticated USING (public.app_role() IS NOT NULL);
CREATE POLICY settings_write ON public.app_settings FOR UPDATE TO authenticated USING (public.app_role()='super_admin');
CREATE POLICY events_read ON public.security_events FOR SELECT TO authenticated USING (public.app_role()='super_admin');
CREATE POLICY assets_read ON public.assets FOR SELECT TO authenticated
  USING (archived_at IS NULL AND public.app_asset_scope(company_code,site,assigned_to));
CREATE POLICY assets_insert ON public.assets FOR INSERT TO authenticated
  WITH CHECK (archived_at IS NULL AND archived_by IS NULL AND public.app_permission('add') AND public.app_asset_scope(company_code,site,assigned_to));
CREATE POLICY assets_update ON public.assets FOR UPDATE TO authenticated
  USING (archived_at IS NULL AND public.app_asset_scope(company_code,site,assigned_to) AND
    (public.app_permission('edit_all') OR public.app_permission('edit_location') OR public.app_permission('edit_status')))
  WITH CHECK (archived_at IS NULL AND public.app_asset_scope(company_code,site,assigned_to));
-- No browser DELETE policy. Archive/restore preserves every dependent row.
REVOKE DELETE ON public.assets FROM authenticated;
REVOKE INSERT, DELETE ON public.profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_company_assignments, public.user_site_assignments, public.security_events FROM authenticated;

CREATE OR REPLACE FUNCTION public.app_protect_asset() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE allowed text[] := ARRAY['updated_at','record_version']; BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN RETURN NEW; END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    IF NOT public.app_permission('delete') THEN RAISE EXCEPTION 'Archive permission required' USING ERRCODE='42501'; END IF;
    allowed := allowed || ARRAY['archived_at','archived_by'];
  ELSE
    IF public.app_permission('edit_all') THEN RETURN NEW; END IF;
    IF public.app_permission('edit_location') THEN allowed := allowed || ARRAY['site','location','latitude','longitude']; END IF;
    IF public.app_permission('edit_status') THEN allowed := allowed || ARRAY['status']; END IF;
  END IF;
  IF (to_jsonb(NEW)-allowed) IS DISTINCT FROM (to_jsonb(OLD)-allowed) THEN
    RAISE EXCEPTION 'You do not have permission to edit these fields' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS app_protect_asset ON public.assets;
CREATE TRIGGER app_protect_asset BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.app_protect_asset();

CREATE OR REPLACE FUNCTION public.archive_assets(p_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.assets; n integer := 0; BEGIN
  IF NOT public.app_permission('delete') THEN RAISE EXCEPTION 'Archive permission required' USING ERRCODE='42501'; END IF;
  IF coalesce(cardinality(p_ids),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Choose between 1 and 500 assets'; END IF;
  -- Lock in a stable order; the entire request rolls back on any denied/missing ID.
  FOR a IN SELECT * FROM public.assets WHERE id=ANY(p_ids) ORDER BY id FOR UPDATE LOOP
    IF NOT coalesce(public.app_asset_scope(a.company_code,a.site,a.assigned_to),false) THEN
      RAISE EXCEPTION 'Asset not accessible' USING ERRCODE='42501';
    END IF;
    n := n + 1;
    IF a.archived_at IS NULL THEN
      UPDATE public.assets SET archived_at=now(), archived_by=auth.uid(), record_version=coalesce(record_version,0)+1 WHERE id=a.id;
      INSERT INTO public.security_events(actor_id,action,entity_id) VALUES(auth.uid(),'asset_archived',a.id);
    END IF;
  END LOOP;
  IF n <> (SELECT count(DISTINCT id) FROM unnest(p_ids) id) THEN RAISE EXCEPTION 'One or more assets were not found'; END IF;
  RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.list_archived_assets() RETURNS SETOF jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_jsonb(a) || jsonb_build_object('deleted_at',a.archived_at,'original_id',a.id)
  FROM public.assets a WHERE a.archived_at IS NOT NULL AND public.app_permission('delete')
    AND public.app_asset_scope(a.company_code,a.site,a.assigned_to) ORDER BY a.archived_at DESC
$$;
CREATE OR REPLACE FUNCTION public.restore_archived_asset(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.assets; BEGIN
  SELECT * INTO a FROM public.assets WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.app_permission('delete') OR NOT coalesce(public.app_asset_scope(a.company_code,a.site,a.assigned_to),false) THEN
    RAISE EXCEPTION 'Asset not accessible' USING ERRCODE='42501';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    UPDATE public.assets SET archived_at=NULL, archived_by=NULL, record_version=coalesce(record_version,0)+1 WHERE id=p_id RETURNING * INTO a;
    INSERT INTO public.security_events(actor_id,action,entity_id) VALUES(auth.uid(),'asset_restored',p_id);
  END IF;
  RETURN to_jsonb(a);
END $$;

-- Public QR is a minimal, read-only projection. Never expose profiles/settings.
CREATE OR REPLACE FUNCTION public.get_public_asset(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id',a.id,'asset_code',a.asset_code,
    'asset_name',CASE WHEN NOT ('asset_name'=ANY(coalesce(s.hidden_fields,'{}'))) THEN a.asset_name END,
    'status',a.status)
  FROM public.assets a CROSS JOIN public.app_settings s
  WHERE a.id=p_id AND a.archived_at IS NULL AND s.id=1
$$;
CREATE OR REPLACE FUNCTION public.update_asset_location(p_asset_id uuid,p_lat numeric,p_lng numeric) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT public.app_permission('edit_location') THEN RAISE EXCEPTION 'Location permission required' USING ERRCODE='42501'; END IF;
  IF p_lat IS NULL OR p_lng IS NULL OR NOT(p_lat BETWEEN -90 AND 90) OR NOT(p_lng BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'Invalid coordinates';
  END IF;
  UPDATE public.assets SET latitude=p_lat,longitude=p_lng WHERE id=p_asset_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asset not accessible' USING ERRCODE='42501'; END IF;
END $$;

-- Stop anonymous direct table access. Existing privileged RPCs need a separate
-- inventory: revoke inherited PUBLIC/anon execute so they cannot bypass RLS.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_asset(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_role(), public.is_admin(), public.is_moderator(),
  public.app_has_company(text), public.app_asset_scope(text,text,uuid), public.app_permission(text),
  public.app_shared_company(uuid), public.archive_assets(uuid[]), public.list_archived_assets(),
  public.restore_archived_asset(uuid), public.update_asset_location(uuid,numeric,numeric) TO authenticated;
GRANT SELECT ON public.user_company_assignments, public.user_site_assignments, public.security_events TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Deny inactive accounts even when a legacy permissive policy exists.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename);
    EXECUTE format('DROP POLICY IF EXISTS active_account_required ON public.%I',t.tablename);
    EXECUTE format('CREATE POLICY active_account_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_role() IS NOT NULL) WITH CHECK (public.app_role() IS NOT NULL)',t.tablename);
  END LOOP;
END $$;

-- Every direct asset child must also satisfy the parent's scope. Existing broad
-- child policies cannot override this restrictive policy.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT c.table_name FROM information_schema.columns c
    JOIN pg_tables p ON p.schemaname=c.table_schema AND p.tablename=c.table_name
    WHERE c.table_schema='public' AND c.column_name='asset_id' AND c.udt_name='uuid'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS asset_parent_scope ON public.%I',t.table_name);
    EXECUTE format('CREATE POLICY asset_parent_scope ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.id=asset_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.assets a WHERE a.id=asset_id))',t.table_name);
  END LOOP;
END $$;
COMMIT;
