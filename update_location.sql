-- Run this script in your Supabase SQL Editor to allow public location updates from QR scans

CREATE OR REPLACE FUNCTION public.update_asset_location(p_asset_id UUID, p_lat NUMERIC, p_lng NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE public.assets
  SET latitude = p_lat, longitude = p_lng, updated_at = NOW()
  WHERE id = p_asset_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
