/**
 * queryKeys.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One place where every maintenance React Query key is spelled out.
 *
 * Why this file exists: the overview hook registered its queries under
 * ['maintenance', 'overview', …] while the ticket mutations invalidated
 * ['maintenance_kpis'] and ['maintenance_sla'], and the work order board
 * invalidated ['maintenance_overview']. None of those strings matched anything,
 * so creating a ticket or moving a card left the dashboard showing stale
 * numbers until a hard refresh. Importing the literals from here means a typo
 * becomes an import error rather than a silent no-op.
 *
 * React Query v5 matches keys by prefix, so invalidating MAINTENANCE_KEYS.overview
 * refreshes every ['maintenance', 'overview', …] query beneath it.
 */

export const MAINTENANCE_KEYS = {
  /** Prefix for the whole module. */
  all: ['maintenance'],

  /** Dashboard / command-center queries — see hooks/useMaintenanceOverview.js */
  overview: ['maintenance', 'overview'],
  overviewKpis: ['maintenance', 'overview', 'kpis'],
  overviewSlaRecords: ['maintenance', 'overview', 'sla_records'],
  overviewActiveWorkOrders: ['maintenance', 'overview', 'active_wos'],
  overviewPmForecast: ['maintenance', 'overview', 'pm_forecast'],
  overviewCosts: ['maintenance', 'overview', 'costs'],

  /** SLA thresholds from fn_get_sla_config(). */
  slaConfig: ['maintenance', 'sla-config'],

  /** Work order board + drawer. */
  workOrders: ['maintenance_work_orders'],

  /** Tickets workspace. */
  tickets: ['maintenance_tickets'],

  /** Parts totals for a list of work orders (see partsService). */
  workOrderPartsTotals: ['maintenance', 'work-order-parts-totals'],
}

/**
 * Everything a maintenance write should refresh. Kept deliberately short: the
 * three prefixes below cover every query the module registers.
 */
export const MAINTENANCE_INVALIDATION_KEYS = [
  MAINTENANCE_KEYS.overview,
  MAINTENANCE_KEYS.workOrders,
  MAINTENANCE_KEYS.tickets,
  MAINTENANCE_KEYS.workOrderPartsTotals,
]
