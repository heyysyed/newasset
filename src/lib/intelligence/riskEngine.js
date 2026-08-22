import { createDomainContract, ConfidenceLevel, DomainStatus } from './intelligenceContract'

/**
 * Asset Risk Engine
 * Calculates deterministic Asset Risk scoring (0-100).
 */

export const RISK_WEIGHTS = {
  age: 20,
  maintenance: 35,
  status: 25,
  idle: 10,
  dataQuality: 10
}

export function calculateAssetRisk(asset, relatedTickets = [], relatedMovements = []) {
  let riskScore = 0
  const riskDrivers = []
  
  // 1. Age Risk (20%)
  const usefulLife = Number(asset.useful_life_years) || 10
  const pDateStr = asset.purchase_date || asset.added_on || asset.created_at
  let yearsOwned = 0
  let ageScore = 0
  
  if (pDateStr) {
    yearsOwned = Math.max(0, (new Date() - new Date(pDateStr)) / (1000 * 60 * 60 * 24 * 365.25))
    const lifeConsumedPct = (yearsOwned / usefulLife) * 100
    if (lifeConsumedPct > 100) ageScore = 100
    else if (lifeConsumedPct > 80) ageScore = 75
    else if (lifeConsumedPct > 50) ageScore = 40
    else ageScore = 10
  }
  
  if (ageScore > 50) riskDrivers.push(`Asset has consumed >${Math.round((yearsOwned/usefulLife)*100)}% of useful life.`)
  riskScore += (ageScore * (RISK_WEIGHTS.age / 100))

  // 2. Maintenance Risk (35%)
  let maintScore = 0
  const openTickets = relatedTickets.filter(t => ['Open', 'In Progress'].includes(t.status))
  const criticalTickets = openTickets.filter(t => ['High', 'Critical'].includes(t.priority))
  const breakdowns = relatedTickets.filter(t => ['breakdown', 'fault'].includes(t.ticket_type))
  
  if (criticalTickets.length > 0) {
    maintScore = 100
    riskDrivers.push(`${criticalTickets.length} critical maintenance tickets open.`)
  } else if (breakdowns.length >= 3) {
    maintScore = 80
    riskDrivers.push(`Repeat failures detected (${breakdowns.length} breakdowns).`)
  } else if (openTickets.length > 0) {
    maintScore = 50
    riskDrivers.push(`${openTickets.length} open maintenance tickets.`)
  } else {
    maintScore = 10 // baseline
  }
  
  riskScore += (maintScore * (RISK_WEIGHTS.maintenance / 100))

  // 3. Status Risk (25%)
  let statusScore = 0
  if (asset.status === 'Down' || asset.status === 'Under Repair') {
    statusScore = 100
    riskDrivers.push(`Asset is currently ${asset.status}.`)
  } else if (asset.status === 'Idle' || asset.status === 'In Storage') {
    statusScore = 60
    riskDrivers.push(`Asset is ${asset.status}.`)
  } else if (asset.condition === 'Poor') {
    statusScore = 80
    riskDrivers.push('Asset condition is marked as Poor.')
  } else {
    statusScore = 10
  }
  riskScore += (statusScore * (RISK_WEIGHTS.status / 100))

  // 4. Idle Risk (10%)
  let idleScore = 0
  const now = new Date()
  let lastActivityDate = null
  
  if (relatedMovements.length > 0) lastActivityDate = new Date(relatedMovements[0].moved_at)
  if (relatedTickets.length > 0) {
    const lastTktDate = new Date(relatedTickets[0].created_at)
    if (!lastActivityDate || lastTktDate > lastActivityDate) lastActivityDate = lastTktDate
  }
  
  if (lastActivityDate) {
    const daysSinceActivity = (now - lastActivityDate) / (1000 * 60 * 60 * 24)
    if (daysSinceActivity > 180) {
      idleScore = 100
      riskDrivers.push(`No recorded activity in >180 days.`)
    } else if (daysSinceActivity > 90) {
      idleScore = 60
      riskDrivers.push(`No recorded activity in >90 days.`)
    } else {
      idleScore = 10
    }
  } else {
    idleScore = 50 
    riskDrivers.push(`No historical activity/movement data found.`)
  }
  riskScore += (idleScore * (RISK_WEIGHTS.idle / 100))

  // 5. Data Quality Risk (10%)
  let dataScore = 0
  const criticalFields = ['site', 'category', 'purchase_value', 'useful_life_years', 'status']
  let missingFields = 0
  criticalFields.forEach(f => {
    if (!asset[f]) missingFields++
  })
  if (missingFields > 2) {
    dataScore = 100
    riskDrivers.push(`Severe missing data (${missingFields} critical fields missing).`)
  } else if (missingFields > 0) {
    dataScore = 50
    riskDrivers.push(`Missing data (${missingFields} fields).`)
  } else {
    dataScore = 0
  }
  riskScore += (dataScore * (RISK_WEIGHTS.dataQuality / 100))

  riskScore = Math.round(riskScore)
  
  let riskClassification = 'Low'
  if (riskScore >= 75) riskClassification = 'Critical'
  else if (riskScore >= 50) riskClassification = 'High'
  else if (riskScore >= 25) riskClassification = 'Moderate'

  return {
    score: riskScore,
    classification: riskClassification,
    drivers: riskDrivers,
    factors: {
      age: `${Math.round(ageScore * (RISK_WEIGHTS.age / 100))}/${RISK_WEIGHTS.age}`,
      maintenance: `${Math.round(maintScore * (RISK_WEIGHTS.maintenance / 100))}/${RISK_WEIGHTS.maintenance}`,
      status: `${Math.round(statusScore * (RISK_WEIGHTS.status / 100))}/${RISK_WEIGHTS.status}`,
      idle: `${Math.round(idleScore * (RISK_WEIGHTS.idle / 100))}/${RISK_WEIGHTS.idle}`,
      dataQuality: `${Math.round(dataScore * (RISK_WEIGHTS.dataQuality / 100))}/${RISK_WEIGHTS.dataQuality}`
    },
    weights: RISK_WEIGHTS,
    methodology: 'Weighted formula based on Age (20%), Maintenance (35%), Status (25%), Activity Proxy (10%), Data Quality (10%).'
  }
}

export function calculatePortfolioRisk(assets = [], tickets = [], movements = []) {
  if (!assets || assets.length === 0) {
    return createDomainContract({
      status: DomainStatus.INSUFFICIENT_DATA,
      value: null,
      source: 'assets, tickets, movements',
      confidence: ConfidenceLevel.LOW,
      methodology: 'Cannot calculate portfolio risk without assets.',
      data: { criticalAssets: [], all: [] }
    })
  }

  // Optimize by only scoring top 100 by value to prevent browser lag on huge datasets
  const topAssets = [...assets]
    .sort((a, b) => (Number(b.purchase_value) || 0) - (Number(a.purchase_value) || 0))
    .slice(0, 100)

  const scored = topAssets.map(a => {
    const aTkts = tickets.filter(t => t.asset_id === a.id)
    const aMovs = movements.filter(m => m.asset_id === a.id)
    return { ...a, risk: calculateAssetRisk(a, aTkts, aMovs) }
  })

  const criticalAssets = scored
    .filter(a => a.risk.classification === 'Critical' || a.risk.classification === 'High')
    .sort((a, b) => b.risk.score - a.risk.score)

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    value: criticalAssets.length, // Primary value is number of at-risk assets
    recordCount: topAssets.length,
    source: 'assets, tickets, movements',
    confidence: ConfidenceLevel.MEDIUM,
    methodology: 'Calculated individually for top 100 assets by value. ' + scored[0]?.risk?.methodology,
    actions: [{ label: 'View Asset Risk Radar', route: '/admin/reports/asset-risk-radar' }],
    data: {
      criticalAssets: criticalAssets.slice(0, 10), // Top 10 critical
      all: scored
    }
  })
}
