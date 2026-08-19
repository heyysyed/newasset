export function calculateBookValue(asset) {
  const purchase_value = Number(asset.purchase_value)
  const salvage_value = Number(asset.salvage_value || 0)
  const useful_life = Number(asset.useful_life_years || 1)
  const rate = Number(asset.depreciation_rate_percent || 0) / 100
  const method = asset.depreciation_method
  const purchaseDateStr = asset.purchase_date

  if (!purchase_value || isNaN(purchase_value)) return 0
  if (!purchaseDateStr) return purchase_value

  const purchaseDate = new Date(purchaseDateStr)
  const now = new Date()
  
  // Calculate years owned (including fractional years)
  let yearsOwned = (now - purchaseDate) / (1000 * 60 * 60 * 24 * 365.25)
  if (yearsOwned < 0) yearsOwned = 0

  if (method === 'Straight Line') {
    const annualDepreciation = (purchase_value - salvage_value) / useful_life
    const totalDepreciation = annualDepreciation * yearsOwned
    return Math.max(salvage_value, purchase_value - totalDepreciation)
  }

  if (method === 'Reducing Balance' || method === 'Declining Balance') {
    // formula: BV = Cost * (1 - rate)^years
    const currentValue = purchase_value * Math.pow(1 - rate, yearsOwned)
    return Math.max(salvage_value, currentValue)
  }

  return purchase_value
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0)
}
