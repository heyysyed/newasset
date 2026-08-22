import { createDomainContract, ConfidenceLevel, DomainStatus } from './intelligenceContract'
import { resolveAssetLocation, buildLocationIntelligenceContract } from './locationIntelligence'
import { calculateBookValue } from '../depreciation'

// ── CONSTANTS ──
export const ASSET_AGE_THRESHOLDS = {
  NEW: 2,
  MATURE: 5,
  AGING: 8,
  OLD: 12
}

/**
 * Parses the best available date from asset records.
 */
function getBestDate(asset) {
  if (asset.purchase_date) return new Date(asset.purchase_date)
  if (asset.added_on) return new Date(asset.added_on)
  if (asset.created_at) return new Date(asset.created_at)
  return null
}

/**
 * Phase C - Age Intelligence
 */
export function calculateAgeIntelligence(asset) {
  const authoritativeDate = getBestDate(asset)
  if (!authoritativeDate) {
    return createDomainContract({
      status: DomainStatus.INSUFFICIENT_DATA,
      confidence: ConfidenceLevel.LIMITED,
      source: 'assets',
      methodology: 'No valid purchase or creation date available.',
      data: null
    })
  }

  const now = new Date()
  const ageInYears = Math.max(0, (now - authoritativeDate) / (1000 * 60 * 60 * 24 * 365.25))
  const ageInDays = Math.max(0, (now - authoritativeDate) / (1000 * 60 * 60 * 24))
  
  // Format age string
  let ageString = ''
  if (ageInDays < 30) {
    ageString = `${Math.floor(ageInDays)} days`
  } else if (ageInDays < 365) {
    ageString = `${Math.floor(ageInDays / 30)} months`
  } else {
    const y = Math.floor(ageInYears)
    const m = Math.floor((ageInDays % 365) / 30)
    ageString = m > 0 ? `${y} years ${m} months` : `${y} years`
  }

  let lifecycleStage = 'UNKNOWN'
  if (ageInYears <= ASSET_AGE_THRESHOLDS.NEW) lifecycleStage = 'NEW'
  else if (ageInYears <= ASSET_AGE_THRESHOLDS.MATURE) lifecycleStage = 'EARLY LIFE'
  else if (ageInYears <= ASSET_AGE_THRESHOLDS.AGING) lifecycleStage = 'MATURE'
  else if (ageInYears <= ASSET_AGE_THRESHOLDS.OLD) lifecycleStage = 'LATE LIFE'
  else lifecycleStage = 'END OF LIFE'

  // Useful Life
  const usefulLifeYears = Number(asset.useful_life_years) || null
  let lifeConsumedPct = null
  let lifeRemainingPct = null
  let expectedEnd = null
  let remainingYears = null

  if (usefulLifeYears) {
    lifeConsumedPct = Math.min(100, Math.round((ageInYears / usefulLifeYears) * 100))
    lifeRemainingPct = Math.max(0, 100 - lifeConsumedPct)
    
    const end = new Date(authoritativeDate)
    end.setFullYear(end.getFullYear() + usefulLifeYears)
    expectedEnd = end.toISOString().split('T')[0]
    
    remainingYears = Math.max(0, usefulLifeYears - ageInYears).toFixed(1)
    
    // Override lifecycle stage based on consumption if data available
    if (lifeConsumedPct < 25) lifecycleStage = 'NEW'
    else if (lifeConsumedPct < 50) lifecycleStage = 'ACTIVE LIFE'
    else if (lifeConsumedPct < 75) lifecycleStage = 'AGING'
    else if (lifeConsumedPct < 100) lifecycleStage = 'LATE LIFE'
    else lifecycleStage = 'END OF LIFE CANDIDATE'
  }

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    confidence: ConfidenceLevel.HIGH,
    source: asset.purchase_date ? 'assets.purchase_date' : 'assets.added_on',
    methodology: usefulLifeYears ? 'Age compared against defined useful life.' : 'Age calculated chronologically without useful life definition.',
    data: {
      ageInYears: Number(ageInYears.toFixed(1)),
      ageString,
      acquisitionDate: authoritativeDate.toISOString().split('T')[0],
      usefulLifeYears,
      lifeConsumedPct,
      lifeRemainingPct,
      expectedEnd,
      remainingYears,
      lifecycleStage
    }
  })
}

/**
 * Phase E - Single Asset Health
 */
export function calculateSingleAssetHealth(asset, tickets = []) {
  let score = 100
  let components = {
    condition: { score: 100, weight: 25, evidence: 'Operational' },
    maintenance: { score: 100, weight: 30, evidence: 'No critical issues' },
    age: { score: 100, weight: 20, evidence: 'Within lifecycle limits' },
    status: { score: 100, weight: 15, evidence: 'Active' },
    dataQuality: { score: 100, weight: 10, evidence: 'Basic fields present' }
  }

  // 1. Condition
  if (asset.condition === 'Poor' || asset.condition === 'Critical' || asset.condition === 'Non-Functional') {
    components.condition = { score: 20, weight: 25, evidence: `Condition marked as ${asset.condition}` }
  } else if (asset.condition === 'Needs Repair' || asset.condition === 'Damaged') {
    components.condition = { score: 50, weight: 25, evidence: `Condition marked as ${asset.condition}` }
  }

  // 2. Maintenance
  const openTkts = tickets.filter(t => ['Open', 'In Progress'].includes(t.status))
  const critical = openTkts.filter(t => ['High', 'Critical'].includes(t.priority))
  if (critical.length > 0) {
    components.maintenance = { score: 20, weight: 30, evidence: `${critical.length} critical tickets open` }
  } else if (openTkts.length > 0) {
    components.maintenance = { score: 70, weight: 30, evidence: `${openTkts.length} normal tickets open` }
  }

  // 3. Age
  const ageInt = calculateAgeIntelligence(asset)
  if (ageInt.data?.lifeConsumedPct) {
    if (ageInt.data.lifeConsumedPct >= 100) {
      components.age = { score: 20, weight: 20, evidence: `>${100}% of useful life consumed` }
    } else if (ageInt.data.lifeConsumedPct > 75) {
      components.age = { score: 60, weight: 20, evidence: `>${75}% of useful life consumed` }
    }
  } else if (ageInt.data?.ageInYears > ASSET_AGE_THRESHOLDS.OLD) {
    components.age = { score: 40, weight: 20, evidence: 'Age exceeds standard generic thresholds' }
  }

  // 4. Status
  if (asset.status === 'Down' || asset.status === 'Disposed') {
    components.status = { score: 0, weight: 15, evidence: `Status is ${asset.status}` }
  } else if (asset.status === 'Under Repair') {
    components.status = { score: 50, weight: 15, evidence: `Status is ${asset.status}` }
  } else if (asset.status === 'Inactive') {
    components.status = { score: 80, weight: 15, evidence: 'Asset is inactive' }
  }

  // Calculate total
  score = Object.values(components).reduce((sum, c) => sum + (c.score * (c.weight / 100)), 0)

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    confidence: ConfidenceLevel.HIGH,
    source: 'assets, tickets',
    methodology: 'Weighted composite of condition, maintenance, age, and operational status.',
    data: {
      score: Math.round(score),
      components
    }
  })
}

/**
 * Phase H & I - Maintenance Intelligence
 */
export function calculateMaintenanceIntelligence(asset, tickets = []) {
  if (!tickets || tickets.length === 0) {
    return createDomainContract({
      status: DomainStatus.SUCCESS,
      confidence: ConfidenceLevel.HIGH,
      source: 'maintenance_tickets',
      methodology: 'Count and categorization of all linked maintenance records.',
      data: {
        totalEvents: 0, openTickets: 0, closedTickets: 0, overdueTickets: 0,
        breakdownCount: 0, lastMaintenance: null
      }
    })
  }

  const openTickets = tickets.filter(t => ['Open', 'In Progress'].includes(t.status))
  const closedTickets = tickets.filter(t => ['Resolved', 'Closed'].includes(t.status))
  const overdueTickets = openTickets.filter(t => t.due_date && new Date(t.due_date) < new Date())
  const breakdowns = tickets.filter(t => ['breakdown', 'fault'].includes(t.ticket_type?.toLowerCase()))
  
  const sortedByDate = [...tickets].sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
  const lastMaintenance = sortedByDate.find(t => ['Resolved', 'Closed'].includes(t.status))?.created_at || null

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    confidence: ConfidenceLevel.HIGH,
    source: 'maintenance_tickets',
    methodology: 'Count and categorization of all linked maintenance records.',
    data: {
      totalEvents: tickets.length,
      openTickets: openTickets.length,
      closedTickets: closedTickets.length,
      overdueTickets: overdueTickets.length,
      breakdownCount: breakdowns.length,
      lastMaintenance
    }
  })
}

/**
 * Phase G - Location Intelligence
 */
export function calculateLocationIntelligence(asset, siteObj) {
  let state = 'UNKNOWN'
  let precision = 'NO LOCATION'
  let lat = null, lng = null
  let siteName = siteObj?.name || asset.site || 'Unknown Site'

  if (asset.latitude && asset.longitude) {
    state = 'MAPPED'
    precision = 'EXACT LOCATION'
    lat = asset.latitude
    lng = asset.longitude
  } else if (siteObj?.latitude && siteObj?.longitude) {
    state = 'MAPPED'
    precision = 'SITE LEVEL'
    lat = siteObj.latitude
    lng = siteObj.longitude
  }

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    confidence: precision === 'EXACT LOCATION' ? ConfidenceLevel.HIGH : (precision === 'SITE LEVEL' ? ConfidenceLevel.MEDIUM : ConfidenceLevel.LIMITED),
    source: 'assets, sites',
    methodology: 'Prioritizes asset exact coordinates, falls back to site coordinates.',
    data: {
      state,
      precision,
      lat,
      lng,
      siteName
    }
  })
}

/**
 * Phase P - Data Quality
 */
export function calculateDataQuality(asset) {
  const criticalFields = ['asset_code', 'asset_name', 'category', 'site', 'purchase_date', 'purchase_value', 'useful_life_years', 'status', 'condition', 'serial_no']
  let presentCount = 0
  let missing = []

  criticalFields.forEach(f => {
    if (asset[f] !== undefined && asset[f] !== null && asset[f] !== '') {
      presentCount++
    } else {
      missing.push(f)
    }
  })

  const score = Math.round((presentCount / criticalFields.length) * 100)

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    confidence: ConfidenceLevel.HIGH,
    source: 'assets',
    methodology: 'Presence check of 10 critical asset identity and lifecycle fields.',
    data: {
      score,
      missing
    }
  })
}

/**
 * Phase L - Warranty Intelligence
 */
export function calculateWarrantyIntelligence(asset) {
  if (!asset.warranty_expiry) {
    return createDomainContract({
      status: DomainStatus.INSUFFICIENT_DATA,
      confidence: ConfidenceLevel.LIMITED,
      source: 'assets.warranty_expiry',
      methodology: 'No warranty expiry date recorded.',
      data: null
    })
  }

  const expiry = new Date(asset.warranty_expiry)
  const now = new Date()
  const daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))

  let state = 'ACTIVE'
  if (daysRemaining < 0) state = 'EXPIRED'
  else if (daysRemaining <= 30) state = 'EXPIRING SOON'

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    confidence: ConfidenceLevel.HIGH,
    source: 'assets.warranty_expiry',
    methodology: 'Chronological comparison to current date.',
    data: {
      state,
      daysRemaining,
      expiryDate: asset.warranty_expiry
    }
  })
}

/**
 * Master Aggregator - Phase A
 */
export function buildAsset360(asset, { tickets = [], movements = [], site = null, audits = [] } = {}) {
  // 1. Core domains
  const age = calculateAgeIntelligence(asset)
  const health = calculateSingleAssetHealth(asset, tickets)
  const identity = createDomainContract({
    status: DomainStatus.SUCCESS, confidence: ConfidenceLevel.HIGH, source: 'assets', methodology: 'Core record extraction',
    data: { name: asset.asset_name, code: asset.asset_code, category: asset.category }
  })

  const pv = Number(asset.purchase_value) || 0
  const bv = calculateBookValue(asset)
  const sv = Number(asset.salvage_value) || 0
  const financial = createDomainContract({
    status: pv > 0 ? DomainStatus.SUCCESS : DomainStatus.INSUFFICIENT_DATA,
    confidence: pv > 0 ? ConfidenceLevel.HIGH : ConfidenceLevel.LIMITED,
    source: 'assets, depreciation',
    methodology: 'Financial status based on purchase and book values.',
    data: { purchaseValue: pv, bookValue: bv, salvageValue: sv, depreciationPercent: pv > 0 ? Math.min(100, Math.round(((pv - bv) / pv) * 100)) : 0 }
  })

  let riskLevel = 'LOW'
  if (health.data?.score < 40) riskLevel = 'CRITICAL'
  else if (health.data?.score < 60) riskLevel = 'HIGH'
  else if (health.data?.score < 80) riskLevel = 'MEDIUM'
  const risk = createDomainContract({
    status: DomainStatus.SUCCESS, confidence: ConfidenceLevel.MEDIUM, source: 'health_score', methodology: 'Inversely proportional to Health Score.',
    data: { level: riskLevel }
  })

  const locRes = resolveAssetLocation(asset, site, movements)
  const location = buildLocationIntelligenceContract(locRes)

  const maintenance = calculateMaintenanceIntelligence(asset, tickets)
  const dataQuality = calculateDataQuality(asset)
  const warranty = calculateWarrantyIntelligence(asset)

  const attention = []
  
  if (asset.status === 'Down' || asset.status === 'Under Repair') {
    attention.push({ severity: 'CRITICAL', title: `Asset is ${asset.status}`, explanation: 'Operations halted', actionLabel: 'Review Maintenance' })
  }
  if (maintenance.data?.overdueTickets > 0) {
    attention.push({ severity: 'HIGH', title: `${maintenance.data.overdueTickets} PMs overdue`, explanation: 'Risk of critical failure', actionLabel: 'View Tickets' })
  }
  if (warranty.data?.state === 'EXPIRING SOON') {
    attention.push({ severity: 'HIGH', title: `Warranty expires in ${warranty.data.daysRemaining} days`, explanation: 'Cost exposure on repairs', actionLabel: 'Check Terms' })
  }
  if (age.data?.lifeConsumedPct > 85 && age.data?.lifeConsumedPct < 100) {
    attention.push({ severity: 'MEDIUM', title: `${age.data.lifeConsumedPct}% useful life consumed`, explanation: 'Approaching End of Life', actionLabel: 'Plan Replacement' })
  } else if (age.data?.lifeConsumedPct >= 100) {
    attention.push({ severity: 'HIGH', title: `Exceeded useful life (${age.data.lifeConsumedPct}%)`, explanation: 'High maintenance burden', actionLabel: 'Replacement Candidate' })
  }
  if (dataQuality.data?.score < 70) {
    attention.push({ severity: 'MEDIUM', title: 'Incomplete Data', explanation: 'Analytic accuracy degraded', actionLabel: 'Edit Asset' })
  }

  const recommendations = []
  if (age.data?.lifeConsumedPct >= 100) {
    recommendations.push('Review Replacement Planning: Asset has exceeded defined useful life.')
  }
  if (attention.some(a => a.actionLabel === 'Review Maintenance')) {
    recommendations.push('Expedite open repair tickets to restore operational status.')
  }
  if (dataQuality.data?.missing.includes('purchase_value') || dataQuality.data?.missing.includes('useful_life_years')) {
    recommendations.push('Update financial fields (Value, Useful Life) to unlock Depreciation & Age Analytics.')
  }

  return {
    asset, identity, age, health, risk, maintenance, financial, location, dataQuality, warranty, attention, recommendations,
    generatedAt: new Date().toISOString()
  }
}
