/**
 * calculateBookValue
 * ------------------
 * @param {object} asset         — asset row from DB
 * @param {number} [overridePurchaseValue]  — Total Asset Value (base + capitalised parts).
 *   If supplied, depreciation is calculated against this combined total rather than
 *   the raw purchase_value. This is the Aug-26 fix: capitalised parts must be
 *   depreciated alongside the original asset cost.
 */
export function calculateBookValue(asset, overridePurchaseValue = null) {
  const base_value   = Number(asset.purchase_value)
  const startValue   = overridePurchaseValue != null ? Number(overridePurchaseValue) : base_value
  const salvage_value = Number(asset.salvage_value || 0)
  const useful_life   = Number(asset.useful_life_years || 1)
  const rate          = Number(asset.depreciation_rate_percent || 0) / 100
  const method        = asset.depreciation_method
  const purchaseDateStr = asset.purchase_date

  if (!startValue || isNaN(startValue)) return 0
  if (!purchaseDateStr) return startValue

  const purchaseDate = new Date(purchaseDateStr)
  const now = new Date()

  let yearsOwned = (now - purchaseDate) / (1000 * 60 * 60 * 24 * 365.25)
  if (yearsOwned < 0) yearsOwned = 0

  if (method === 'Straight Line') {
    const annualDepreciation = (startValue - salvage_value) / useful_life
    const totalDepreciation = annualDepreciation * yearsOwned
    return Math.max(salvage_value, startValue - totalDepreciation)
  }

  if (method === 'Reducing Balance' || method === 'Declining Balance') {
    const currentValue = startValue * Math.pow(1 - rate, yearsOwned)
    return Math.max(salvage_value, currentValue)
  }

  return startValue
}

export function formatCurrency(value) {
  if (value === null || value === undefined) return '\u20B90'
  const num = Number(value)
  if (isNaN(num)) return '\u20B90'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}
