# Database & Data Quality Audit (Phase 0)

## Schema Overview
The database uses Supabase PostgreSQL and handles everything from Auth profiles to complex entities like Assets, Maintenance, Inventory, Procurement, and Checklists.

### Missing Tables & Relationships
- **Missing Project Hierarchy:** There are no normalized tables for `projects`, `buildings`, `floors`, `zones`. The `site` and `location` fields on `assets` are just `TEXT` columns, which prevents cascading updates and proper referential integrity.
- **Maintenance Relationships:** `maintenance_tickets` relies on text fields for `failure_code`, `root_cause`, and parts used instead of normalized relational tables.
- **Procurement Links:** Missing strict links between PO receipt items and newly created assets/inventory (currently handled via separate transactions).

## Data Quality Vulnerabilities
*Note: Read-only inspection of the live database could not be fully executed securely without authorized service role keys in this environment, but the schema reveals the following structural vulnerabilities:*

1. **Negative Inventory:** The `inventory_items.current_stock` column is `NUMERIC(15,3)` but lacks a `CHECK (current_stock >= 0)` constraint, meaning the database allows negative stock balances if the UI fails to validate.
2. **Orphaned Assets:** The `site` and `department` fields are text-based. Deleting or renaming a site in the UI (if supported) would not update the assets, leaving orphaned or invalid text references.
3. **Inactive User Assignment:** There is no constraint or trigger to unassign or flag an asset if the `assigned_to` profile becomes `is_active = false`.
4. **Duplicate Records:** `assets.asset_code` is `UNIQUE NOT NULL`, which correctly prevents duplicate asset codes. However, `serial_no` is not unique, allowing multiple assets with the exact same serial number.

## Row Level Security (RLS) Penetration Audit
An analysis of `supabase-setup.sql` reveals severe cross-tenant data access vulnerabilities:

- **Global Read Access:** 
  ```sql
  CREATE POLICY "assets_read_auth" ON public.assets FOR SELECT USING (auth.role() = 'authenticated');
  ```
  Any authenticated user can query *all* assets in the database, regardless of their assigned project or site.
- **Global Write Access for Certain Modules:**
  ```sql
  CREATE POLICY "maint_sched_auth" ON public.maintenance_schedules FOR ALL USING (auth.role() = 'authenticated');
  ```
  Any authenticated user can theoretically use the Supabase API to edit or delete any maintenance schedule, not just their own.
- **Profile Leakage:**
  ```sql
  CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
  ```
  Unauthenticated and authenticated users can view all profile data (including emails and phone numbers) for everyone in the system.

These RLS policies must be locked down using the new `Scope` permission model proposed in Phase 1.
