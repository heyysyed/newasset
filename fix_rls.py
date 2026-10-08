import re

file_path = 'supabase-setup.sql'

with open(file_path, 'r') as f:
    content = f.read()

# Tables to fix
tables = [
    'purchase_orders', 'po_items', 'maintenance_tickets', 'maintenance_schedules',
    'maintenance_logs', 'maintenance_photos', 'ticket_comments', 'inventory_items',
    'inventory_transactions', 'inventory_requests', 'bulk_items', 'bulk_site_stock',
    'bulk_transactions', 'gate_passes', 'gate_pass_items'
]

for table in tables:
    pattern = r'(CREATE POLICY\s+"[^"]+"\s+ON\s+public\.' + table + r'\s+FOR ALL\s+USING\s+\(auth\.role\(\)\s*=\s*\'authenticated\'\);)'
    match = re.search(pattern, content)
    if match:
        original = match.group(1)
        policy_name = original.split('"')[1]
        base_name = policy_name.replace("_auth", "")
        
        replacement = f"""CREATE POLICY "{base_name}_select" ON public.{table} FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "{base_name}_insert" ON public.{table} FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "{base_name}_update" ON public.{table} FOR UPDATE USING (public.is_moderator());
CREATE POLICY "{base_name}_delete" ON public.{table} FOR DELETE USING (public.is_admin());"""
        
        content = content.replace(original, replacement)
        
        drop_pattern = r'DROP POLICY IF EXISTS\s+"' + policy_name + r'"\s+ON\s+public\.' + table + r';'
        drop_replacement = f"""DROP POLICY IF EXISTS "{base_name}_select" ON public.{table};
DROP POLICY IF EXISTS "{base_name}_insert" ON public.{table};
DROP POLICY IF EXISTS "{base_name}_update" ON public.{table};
DROP POLICY IF EXISTS "{base_name}_delete" ON public.{table};"""
        content = re.sub(drop_pattern, drop_replacement, content)

content = content.replace("CREATE POLICY \"assets_update_auth\"    ON public.assets FOR UPDATE USING (auth.role() = 'authenticated');",
                          "CREATE POLICY \"assets_update_auth\"    ON public.assets FOR UPDATE USING (public.is_moderator());")

with open(file_path, 'w') as f:
    f.write(content)

print("RLS policies updated successfully.")
