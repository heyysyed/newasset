import { createDomainContract, ConfidenceLevel, DomainStatus } from './intelligenceContract'

/**
 * Inventory Intelligence Engine
 * Evaluates stockouts, low stock, exposure, and burn rate.
 */

export function calculateInventoryIntelligence(items = [], transactions = []) {
  if (!items || items.length === 0) {
    return createDomainContract({
      status: DomainStatus.INSUFFICIENT_DATA,
      value: null,
      recordCount: 0,
      source: 'inventory_items, inventory_transactions',
      confidence: ConfidenceLevel.LOW,
      methodology: 'No inventory items found.',
      data: {
        stockValue: 0,
        stockoutItemsCount: 0,
        lowStockItemsCount: 0,
        stockoutRiskItems: [],
        totalConsumptionLast30Days: 0,
        averageDailyBurn: null
      }
    })
  }

  let stockValue = 0
  let stockoutItemsCount = 0
  let lowStockItemsCount = 0
  
  const stockoutRiskItems = []
  
  items.forEach(item => {
    const qty = Number(item.current_stock) || 0
    const cost = Number(item.unit_cost) || 0
    const reorderLevel = Number(item.reorder_level) || 0

    stockValue += (qty * cost)

    if (qty <= 0) {
      stockoutItemsCount++
      stockoutRiskItems.push({
        id: item.id,
        item_name: item.item_name,
        current_stock: qty,
        status: 'Stockout',
        financialExposure: cost * (reorderLevel || 10)
      })
    } else if (reorderLevel > 0 && qty <= reorderLevel) {
      lowStockItemsCount++
      stockoutRiskItems.push({
        id: item.id,
        item_name: item.item_name,
        current_stock: qty,
        reorder_level: reorderLevel,
        status: 'Low Stock',
        financialExposure: cost * (reorderLevel - qty)
      })
    }
  })

  // Basic Burn Rate Analysis over last 30 days
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  
  let totalConsumptionLast30Days = 0
  let relevantTxnCount = 0

  transactions.forEach(txn => {
    const txnDate = new Date(txn.transaction_at)
    if (txnDate >= thirtyDaysAgo) {
      if (txn.transaction_type === 'issue' || txn.transaction_type === 'consumed') {
        totalConsumptionLast30Days += Number(txn.quantity) || 0
        relevantTxnCount++
      }
    }
  })

  // Only calculate burn rate if there's sufficient historical transaction volume
  const averageDailyBurn = relevantTxnCount > 5 
    ? Math.round((totalConsumptionLast30Days / 30) * 10) / 10 
    : null

  const confidence = transactions.length > 0 ? ConfidenceLevel.HIGH : ConfidenceLevel.MEDIUM

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    value: Math.round(stockValue),
    recordCount: items.length,
    source: 'inventory_items, inventory_transactions',
    confidence,
    methodology: averageDailyBurn !== null 
      ? 'Inventory value calculated from current stock and unit cost. Burn rate calculated uniformly from last 30 days of consumption.'
      : 'Inventory value calculated from current stock. Insufficient consumption history to calculate burn rate.',
    actions: [{ label: 'View Inventory Position', route: '/admin/reports/inventory-aging-report' }],
    data: {
      stockValue: Math.round(stockValue),
      stockoutItemsCount,
      lowStockItemsCount,
      stockoutRiskItems: stockoutRiskItems.sort((a,b) => b.financialExposure - a.financialExposure).slice(0, 50),
      totalConsumptionLast30Days: Math.round(totalConsumptionLast30Days),
      averageDailyBurn
    }
  })
}
