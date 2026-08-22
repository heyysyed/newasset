DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Loop through all foreign keys that point to the "assets" table
    FOR r IN 
        SELECT 
            tc.table_name, 
            kcu.column_name, 
            tc.constraint_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name = 'assets' 
          AND ccu.table_schema = 'public'
    LOOP
        -- Drop the old constraint that blocks deletion
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
        
        -- Re-add the constraint with 'ON DELETE CASCADE'
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.assets(id) ON DELETE CASCADE', r.table_name, r.constraint_name, r.column_name);
    END LOOP;
END $$;
