-- 1. Sites Table Enhancements
ALTER TABLE sites ADD COLUMN IF NOT EXISTS site_code TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS asset_sequence_counter INT DEFAULT 1;

-- 2. Fast Lookup & Array Indexes
CREATE INDEX IF NOT EXISTS idx_sites_site_code ON sites(site_code);
CREATE INDEX IF NOT EXISTS idx_sites_aliases ON sites USING GIN (aliases);

-- 3. Seed / Normalize Default Site Codes & Standard Aliases
UPDATE sites SET site_code = 'P100', aliases = ARRAY['HO', 'HEAD OFFICE', 'HQ'] WHERE name ILIKE '%HEAD OFFICE%';
UPDATE sites SET site_code = 'P148', aliases = ARRAY['WORLI', 'AAKASA', 'AKASHA'] WHERE name ILIKE '%AAKASHA%' OR name ILIKE '%AKASHA%';
UPDATE sites SET site_code = 'P149', aliases = ARRAY['MARQUEE', 'MRQ'] WHERE name ILIKE '%MARQUEE%';
UPDATE sites SET site_code = 'P150', aliases = ARRAY['STELLA', 'KHERNAGAR'] WHERE name ILIKE '%STELLA%';
UPDATE sites SET site_code = 'P152', aliases = ARRAY['KISMET', 'BANDRA'] WHERE name ILIKE '%KISMET%';
UPDATE sites SET site_code = 'P154', aliases = ARRAY['ALPHA', 'GHATKOPAR'] WHERE name ILIKE '%ALPHA%';
UPDATE sites SET site_code = 'P155', aliases = ARRAY['KASDOL', 'CASA DEL'] WHERE name ILIKE '%CASA DEL%' OR name ILIKE '%KASDOL%';
UPDATE sites SET site_code = 'P156', aliases = ARRAY['LAKHI', 'LAKHI HOUSE'] WHERE name ILIKE '%LAKHI%';
UPDATE sites SET site_code = 'P157', aliases = ARRAY['PANCHSEEL', 'PNCH'] WHERE name ILIKE '%PANCHSEEL%';
UPDATE sites SET site_code = 'P158', aliases = ARRAY['BALMORAL', 'BAL'] WHERE name ILIKE '%BALMORAL%';
UPDATE sites SET site_code = 'P159', aliases = ARRAY['CLIFF TOWER', 'CLIFF'] WHERE name ILIKE '%CLIFF TOWER%';
UPDATE sites SET site_code = 'CS',   aliases = ARRAY['CENTRAL STORE', 'ANJUR', 'STORE'] WHERE name ILIKE '%CENTRAL STORE%';
