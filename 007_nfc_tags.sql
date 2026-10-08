-- Add NFC tag ID column for asset tracking
ALTER TABLE public.assets 
ADD COLUMN IF NOT EXISTS nfc_tag_id TEXT UNIQUE;

-- Create an index to quickly lookup assets by NFC tag ID
CREATE INDEX IF NOT EXISTS idx_assets_nfc_tag 
ON public.assets (nfc_tag_id);

-- Also add it to deleted_assets to preserve it when deleted/restored
ALTER TABLE public.deleted_assets 
ADD COLUMN IF NOT EXISTS nfc_tag_id TEXT;
