-- 1. Fix is_admin to include super_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix is_moderator to include super_admin
CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'moderator'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a helper function to check if the user can delete an asset
-- This checks if they are admin/super_admin, OR if they are a moderator AND have the 'can_delete' permission enabled in app_settings
CREATE OR REPLACE FUNCTION public.can_delete_asset()
RETURNS BOOLEAN AS $$
DECLARE
  _role TEXT;
  _can_delete BOOLEAN;
BEGIN
  SELECT role INTO _role FROM public.profiles WHERE id = auth.uid();
  
  IF _role IN ('admin', 'super_admin') THEN
    RETURN TRUE;
  ELSIF _role = 'moderator' THEN
    SELECT (moderator_permissions->>'can_delete')::boolean INTO _can_delete FROM public.app_settings WHERE id = 1;
    RETURN COALESCE(_can_delete, false);
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update the delete policy for the assets table to use the new helper function
DROP POLICY IF EXISTS "assets_delete_admin" ON public.assets;

CREATE POLICY "assets_delete_admin"
  ON public.assets
  FOR DELETE
  USING (public.can_delete_asset());
