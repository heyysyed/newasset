-- WARNING: THIS WILL PERMANENTLY DELETE ALL ASSETS, INVENTORY, GATE PASSES, AND TICKETS.
-- It will NOT delete your user accounts, passwords, or company settings.

TRUNCATE TABLE 
  public.assets, 
  public.deleted_assets,
  public.bulk_items,
  public.bulk_site_stock,
  public.bulk_transactions,
  public.gate_passes,
  public.gate_pass_items,
  public.maintenance_tickets,
  public.maintenance_logs,
  public.activity_logs,
  public.inventory_items,
  public.audit_sessions,
  public.asset_audit
CASCADE;
