/**
 * Construction Inventory & Material Burn Rate Calculations
 */

/**
 * Calculates Total Inventory Valuation
 * Valuation = Quantity on Hand * Unit Cost
 */
export function calculateInventoryValuation(quantity = 0, unitCost = 0) {
  const qty = Math.max(0, Number(quantity) || 0)
  const cost = Math.max(0, Number(unitCost) || 0)
  return Math.round(qty * cost)
}

/**
 * Calculates Stock Variance & Valuation Variance (Physical - System)
 */
export function calculateStockVariance(physicalCount = 0, systemCount = 0, unitCost = 0) {
  const phys = Math.max(0, Number(physicalCount) || 0)
  const sys = Math.max(0, Number(systemCount) || 0)
  const varianceQty = phys - sys
  const varianceValue = varianceQty * (Number(unitCost) || 0)

  return {
    varianceQty,
    varianceValue: Math.round(varianceValue),
    isDiscrepancy: varianceQty !== 0
  }
}

/**
 * Calculates Monthly Consumption Burn Rate & Stockout Risk Days
 */
export function calculateStockoutForecast(currentQuantity = 0, monthlyBurnQuantity = 30) {
  const qty = Math.max(0, Number(currentQuantity) || 0)
  const burnMonth = Math.max(1, Number(monthlyBurnQuantity) || 30)
  const dailyBurn = burnMonth / 30

  const daysRemaining = dailyBurn > 0 ? Math.round(qty / dailyBurn) : 999

  let riskLevel = 'OPTIMAL'
  if (daysRemaining <= 7) riskLevel = 'CRITICAL'
  else if (daysRemaining <= 15) riskLevel = 'WARNING'

  return {
    daysRemaining,
    riskLevel,
    dailyBurnRate: Math.round(dailyBurn * 10) / 10
  }
}


