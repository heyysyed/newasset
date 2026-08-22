import { supabase } from '../supabase'
import { calculateDataQuality } from './dataQualityEngine'
import { calculateFinancialIntelligence } from './financialEngine'
import { calculateMaintenanceIntelligence } from './maintenanceEngine'
import { calculateInventoryIntelligence } from './inventoryEngine'
import { calculatePortfolioHealth } from './healthEngine'
import { detectAttentionItems } from './attentionEngine'
import { determineConfidence } from './confidenceEngine'
import { calculatePortfolioRisk } from './riskEngine'
import { createGlobalContract, DomainStatus, ConfidenceLevel } from './intelligenceContract'

const VERSION = '2A.8.0'

/**
 * Safe domain wrapper — prevents one failed domain from crashing the whole dashboard.
 * Enforces the standardized domain contract output.
 */
function safeDomain(name, fn) {
  try {
    const result = fn()
    return { status: DomainStatus.SUCCESS, ...result }
  } catch (err) {
    console.error(`[Intelligence] ${name} domain failed:`, err)
    return { status: DomainStatus.ERROR, error: err.message, name }
  }
}

/**
 * Central Intelligence Aggregator v2A.8.0
 *
 * Fetches data in a single batched Promise.all, reuses fetched data across
 * all engines to avoid N+1 queries and duplicate calculations.
 *
 * Returns Standardized Global Contract.
 */
export async function getEnterpriseIntelligence(filters = {}) {
  const { site, category, status } = filters
  const generatedAt = new Date().toISOString()

  // ── 1. Build queries ──────────────────────────────────────────────────────
  let assetQuery = supabase
    .from('assets')
    .select('id, asset_code, asset_name, category, site, status, condition, purchase_value, salvage_value, useful_life_years, added_on, purchase_date, notes')
    .or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')

  if (site && site !== 'All') assetQuery = assetQuery.ilike('site', `%${site.replace(/^\[.*?\]\s*/, '')}%`)
  if (category && category !== 'All') assetQuery = assetQuery.eq('category', category)
  if (status && status !== 'All') assetQuery = assetQuery.eq('status', status)

  // ── 2. Batch fetch ────────────────────────────────────────────────────────
  let fetchError = null
  let rawData = {}

  try {
    const [
      assetsRes,
      ticketsRes,
      logsRes,
      inventoryRes,
      inventoryTxRes,
      movementsRes,
    ] = await Promise.all([
      assetQuery,
      supabase.from('maintenance_tickets')
        .select('id, ticket_no, ticket_type, priority, status, created_at, resolved_at, sla_due_at, asset_id, title')
        .limit(2000),
      supabase.from('maintenance_logs')
        .select('id, asset_id, cost, performed_at')
        .limit(2000),
      supabase.from('inventory_items')
        .select('id, item_code, item_name, current_stock, reorder_level, unit_cost'),
      supabase.from('inventory_transactions')
        .select('id, item_id, transaction_type, quantity, transaction_at')
        .limit(2000),
      supabase.from('asset_movements')
        .select('id, asset_id, moved_at')
        .order('moved_at', { ascending: false })
        .limit(2000),
    ])

    rawData = {
      assets: assetsRes.data || [],
      tickets: ticketsRes.data || [],
      logs: logsRes.data || [],
      inventory: inventoryRes.data || [],
      inventoryTx: inventoryTxRes.data || [],
      movements: movementsRes.data || [],
      assetFetchError: assetsRes.error,
    }
  } catch (err) {
    fetchError = err.message
  }

  if (fetchError) {
    return createGlobalContract({
      status: DomainStatus.ERROR,
      error: fetchError,
      filters,
      generatedAt
    })
  }

  // ── 3. Apply cross-table filtering ────────────────────────────────────────
  const { assets, tickets, logs, inventory, inventoryTx, movements } = rawData
  const validAssetIds = new Set(assets.map(a => a.id))

  // Filter tickets + movements to assets in scope
  const scopedTickets = (site !== 'All' || category !== 'All' || status !== 'All')
    ? tickets.filter(t => validAssetIds.has(t.asset_id))
    : tickets
  const scopedMovements = (site !== 'All' || category !== 'All' || status !== 'All')
    ? movements.filter(m => validAssetIds.has(m.asset_id))
    : movements

  // ── 4. Run intelligence engines (isolated per domain) ─────────────────────
  const dataQuality  = safeDomain('DataQuality',   () => calculateDataQuality(assets))
  const financial    = safeDomain('Financial',     () => calculateFinancialIntelligence(assets))
  const maintenance  = safeDomain('Maintenance',   () => calculateMaintenanceIntelligence(scopedTickets, logs))
  const inventoryI   = safeDomain('Inventory',     () => calculateInventoryIntelligence(inventory, inventoryTx))

  // Health depends on all four above — only pass status=success domains
  const health = safeDomain('Health', () => calculatePortfolioHealth({
    assets,
    maintenanceIntelligence:  maintenance.status === DomainStatus.SUCCESS ? maintenance : null,
    financialIntelligence:    financial.status === DomainStatus.SUCCESS   ? financial   : null,
    dataQualityIntelligence:  dataQuality.status === DomainStatus.SUCCESS ? dataQuality : { score: 0 },
    inventoryIntelligence:    inventoryI.status === DomainStatus.SUCCESS  ? inventoryI  : null,
  }))

  const attention = safeDomain('Attention', () => ({
    items: detectAttentionItems({ assets, tickets: scopedTickets, inventory })
  }))

  // Confidence — based on data completeness
  const confidence = safeDomain('Confidence', () => determineConfidence({
    sampleSize:            assets.length,
    totalPopulation:       assets.length,
    requiredFieldsMissing: dataQuality.status === DomainStatus.SUCCESS ? dataQuality.incompleteRecords : 0,
    hasHistory:            scopedTickets.length > 0 || scopedMovements.length > 0,
  }))

  // Risk scoring — top 100 assets by purchase value (performance guard)
  const topAssets = [...assets]
    .sort((a, b) => (Number(b.purchase_value) || 0) - (Number(a.purchase_value) || 0))
    .slice(0, 100)

  const riskDomain = safeDomain('Risk', () => calculatePortfolioRisk(assets, scopedTickets, scopedMovements))

  // ── 5. Assemble standardised contract ─────────────────────────────────────
  const attentionList = attention.status === DomainStatus.SUCCESS ? (attention.items || []) : []

  const kpis = {
    totalAssets:         assets.length,
    grossAssetValue:     financial.status === DomainStatus.SUCCESS ? (financial.data?.grossAssetValue ?? 0) : null,
    netBookValue:        financial.status === DomainStatus.SUCCESS ? (financial.data?.netBookValue ?? 0)    : null,
    idleCapital:         financial.status === DomainStatus.SUCCESS ? (financial.data?.idleCapital ?? 0)     : null,
    assetsAtRisk:        riskDomain.status === DomainStatus.SUCCESS ? riskDomain.data?.criticalAssets?.length : null,
    maintenanceBacklog:  maintenance.status === DomainStatus.SUCCESS ? maintenance.data?.backlogCount         : null,
    maintenanceOverdue:  maintenance.status === DomainStatus.SUCCESS ? maintenance.data?.overdueCount         : null,
    pmCompliance:        maintenance.status === DomainStatus.SUCCESS ? maintenance.data?.pmCompliance?.score  : null,
    criticalExceptions:  attentionList.filter(e => e.severity === 'CRITICAL').length,
    stockouts:           inventoryI.status === DomainStatus.SUCCESS ? inventoryI.data?.stockoutItemsCount : null,
    lowStockItems:       inventoryI.status === DomainStatus.SUCCESS ? inventoryI.data?.lowStockItemsCount : null,
    dataQualityScore:    dataQuality.status === DomainStatus.SUCCESS ? dataQuality.data?.score : null,
    totalAssetValue:     financial.status === DomainStatus.SUCCESS ? (financial.data?.grossAssetValue ?? 0) : null, // Alias for legacy fallback
  }

  return createGlobalContract({
    status: DomainStatus.SUCCESS,
    generatedAt,
    filters,
    kpis,
    health,
    risk: riskDomain,
    financial,
    maintenance,
    inventory: inventoryI,
    exceptions: attentionList, // Map attention items to exceptions array in contract
    confidence: confidence.status === DomainStatus.SUCCESS ? confidence.level : ConfidenceLevel.LOW,
    dataQuality,
    methodology: 'Enterprise Intelligence v2A.8.0 — deterministic calculations, real Supabase data, isolated domain failures. Attention Engine replaces basic exceptions.'
  })
}
