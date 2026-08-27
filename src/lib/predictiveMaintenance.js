/**
 * Calculates Asset Health Score (0 - 100) and Breakdown Risk Probability
 * based on asset condition, purchase age, maintenance frequency, and breakdown logs.
 */
export function calculateAssetHealth(asset, maintenanceLogs = []) {
  let score = 100

  // 1. Condition Penalty
  const cond = (asset?.condition || '').toLowerCase()
  if (cond === 'damaged' || cond === 'fair') score -= 25
  else if (cond === 'needs_repair' || cond === 'under repair' || cond === 'poor') score -= 45
  else if (cond === 'non_functional' || cond === 'critical') score -= 75
  else if (cond === 'missing') score -= 90

  // 2. Age Penalty (based on purchase_date)
  if (asset?.purchase_date) {
    const ageYears = (new Date() - new Date(asset.purchase_date)) / (1000 * 60 * 60 * 24 * 365.25)
    if (ageYears > 8) score -= 25
    else if (ageYears > 5) score -= 15
    else if (ageYears > 3) score -= 8
  }

  // 3. Breakdown Count Penalty
  const breakdowns = maintenanceLogs.filter(m => 
    (m.ticket_type === 'breakdown' || m.work_order_type === 'breakdown' || (m.notes || '').toLowerCase().includes('breakdown'))
  ).length
  score -= breakdowns * 12

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, Math.round(score)))

  // Rating Badge & Color
  let label = 'Excellent'
  let color = '#059669'
  let bg = 'rgba(5,150,105,0.1)'
  let riskLevel = 'Low Risk (<5%)'

  if (score < 40) {
    label = 'Critical Breakdown Risk'
    color = '#dc2626'
    bg = 'rgba(220,38,38,0.1)'
    riskLevel = 'High Risk (>75%)'
  } else if (score < 70) {
    label = 'Moderate Degradation'
    color = '#d97706'
    bg = 'rgba(217,119,6,0.1)'
    riskLevel = 'Medium Risk (35%)'
  } else if (score < 88) {
    label = 'Good Condition'
    color = '#0891b2'
    bg = 'rgba(8,145,178,0.1)'
    riskLevel = 'Low Risk (12%)'
  }

  return {
    score,
    label,
    color,
    bg,
    riskLevel,
    breakdownCount: breakdowns
  }
}


