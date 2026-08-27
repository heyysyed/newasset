import { createDomainContract, ConfidenceLevel, DomainStatus } from './intelligenceContract'
import { calculateBookValue } from '../depreciation'

/**
 * Site Portfolio Intelligence
 * Calculates aggregate stats for a site based on its assigned assets.
 */
export function calculateSitePortfolioIntelligence(siteAssets = []) {
  if (!siteAssets || siteAssets.length === 0) {
    return createDomainContract({
      status: DomainStatus.INSUFFICIENT_DATA,
      confidence: ConfidenceLevel.HIGH,
      source: 'assets',
      methodology: 'No assets assigned to this site.',
      data: {
        totalAssets: 0, activeAssets: 0, inactiveAssets: 0, downAssets: 0, underMaintenance: 0,
        idleAssets: 0, agingAssets: 0, endOfLifeAssets: 0, highRiskAssets: 0, criticalRiskAssets: 0
      }
    })
  }

  let activeAssets = 0
  let inactiveAssets = 0
  let downAssets = 0
  let underMaintenance = 0
  let idleAssets = 0 // Using Inactive as proxy for now unless movement data suggests otherwise
  let highRiskAssets = 0
  let criticalRiskAssets = 0

  siteAssets.forEach(a => {
    if (a.status === 'Active') activeAssets++
    if (a.status === 'Inactive') inactiveAssets++
    if (a.status === 'Down') downAssets++
    if (a.status === 'Under Repair') underMaintenance++
    if (a.status === 'Idle' || a.status === 'In Storage') idleAssets++
  })

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    confidence: ConfidenceLevel.HIGH,
    source: 'assets',
    methodology: 'Aggregated from real asset records assigned to this site.',
    data: {
      totalAssets: siteAssets.length,
      activeAssets,
      inactiveAssets,
      downAssets,
      underMaintenance,
      idleAssets,
      agingAssets: 0, // Placeholder, calculated later via asset age engine map
      endOfLifeAssets: 0,
      highRiskAssets: 0,
      criticalRiskAssets: 0
    }
  })
}

/**
 * Site Financial Intelligence
 */
export function calculateSiteFinancialIntelligence(siteAssets = [], hasFinancialAccess = false) {
  if (!hasFinancialAccess) {
    return createDomainContract({
      status: DomainStatus.INSUFFICIENT_DATA,
      confidence: ConfidenceLevel.LIMITED,
      source: null,
      methodology: 'Financial information restricted by RBAC.',
      data: null
    })
  }

  let grossAssetValue = 0
  let totalNBV = 0
  let idleCapitalProxy = 0
  let atRiskCapital = 0

  siteAssets.forEach(a => {
    const pv = Number(a.purchase_value) || 0
    const bv = calculateBookValue(a)
    
    grossAssetValue += pv
    totalNBV += bv

    if (a.status === 'Idle' || a.status === 'In Storage' || a.status === 'Inactive') {
      idleCapitalProxy += bv
    }
    if (a.status === 'Down' || a.condition === 'Poor' || a.condition === 'Critical') {
      atRiskCapital += bv
    }
  })

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    confidence: ConfidenceLevel.HIGH,
    source: 'assets.purchase_value, depreciation algorithm',
    methodology: 'Aggregated book values and purchase values of site assets.',
    data: {
      grossAssetValue,
      totalNBV,
      depreciation: Math.max(0, grossAssetValue - totalNBV),
      idleCapitalProxy,
      atRiskCapital
    }
  })
}

/**
 * Site Maintenance Intelligence
 */
export function calculateSiteMaintenanceIntelligence(siteTickets = []) {
  if (!siteTickets || siteTickets.length === 0) {
    return createDomainContract({
      status: DomainStatus.SUCCESS,
      confidence: ConfidenceLevel.HIGH,
      source: 'maintenance_tickets',
      methodology: 'No maintenance tickets recorded for assets at this site.',
      data: {
        openTickets: 0, overdueTickets: 0, criticalTickets: 0, pmCompliance: 100, breakdownCount: 0
      }
    })
  }

  const openTickets = siteTickets.filter(t => ['Open', 'In Progress'].includes(t.status))
  const overdueTickets = openTickets.filter(t => t.due_date && new Date(t.due_date) < new Date())
  const criticalTickets = openTickets.filter(t => ['High', 'Critical'].includes(t.priority))
  const breakdowns = siteTickets.filter(t => ['breakdown', 'fault'].includes(t.ticket_type?.toLowerCase()))
  
  const pmTickets = siteTickets.filter(t => ['preventive', 'pm'].includes(t.ticket_type?.toLowerCase()))
  const pmCompleted = pmTickets.filter(t => ['Resolved', 'Closed'].includes(t.status))
  const pmCompliance = pmTickets.length > 0 ? Math.round((pmCompleted.length / pmTickets.length) * 100) : 100

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    confidence: ConfidenceLevel.HIGH,
    source: 'maintenance_tickets',
    methodology: 'Aggregated ticket statuses linked to site assets.',
    data: {
      totalTickets: siteTickets.length,
      openTickets: openTickets.length,
      overdueTickets: overdueTickets.length,
      criticalTickets: criticalTickets.length,
      breakdownCount: breakdowns.length,
      pmCompliance
    }
  })
}

/**
 * Master Aggregator for Site 360
 */
export function buildSite360(site, { assets = [], tickets = [], hasFinancialAccess = false } = {}) {
  const portfolio = calculateSitePortfolioIntelligence(assets)
  const financial = calculateSiteFinancialIntelligence(assets, hasFinancialAccess)
  const maintenance = calculateSiteMaintenanceIntelligence(tickets)
  
  // Base location off site coordinates
  const location = createDomainContract({
    status: (site.latitude && site.longitude) ? DomainStatus.SUCCESS : DomainStatus.INSUFFICIENT_DATA,
    confidence: (site.latitude && site.longitude) ? ConfidenceLevel.HIGH : ConfidenceLevel.LIMITED,
    source: 'sites',
    methodology: 'Site defined coordinates',
    data: {
      latitude: site.latitude,
      longitude: site.longitude,
      radius_meters: site.radius_meters || 200,
      precision: 'SITE_LEVEL'
    }
  })

  // Basic Risk Assessment for Site
  let riskLevel = 'LOW'
  let riskScore = 0
  if (maintenance.data?.criticalTickets > 2 || maintenance.data?.pmCompliance < 50) {
    riskScore += 40
  }
  if (portfolio.data?.downAssets > 2) {
    riskScore += 30
  }
  if (riskScore >= 70) riskLevel = 'CRITICAL'
  else if (riskScore >= 40) riskLevel = 'HIGH'
  else if (riskScore >= 20) riskLevel = 'MEDIUM'

  const risk = createDomainContract({
    status: DomainStatus.SUCCESS,
    confidence: ConfidenceLevel.MEDIUM,
    source: 'composite',
    methodology: 'Aggregated risk from maintenance backlog and down assets.',
    data: {
      score: riskScore,
      level: riskLevel
    }
  })

  // Health Score
  let healthScore = 100 - riskScore
  const health = createDomainContract({
    status: DomainStatus.SUCCESS,
    confidence: ConfidenceLevel.MEDIUM,
    source: 'composite',
    methodology: 'Inverse of aggregated risk score.',
    data: {
      score: healthScore
    }
  })

  // Attention Engine
  const attention = []
  if (maintenance.data?.overdueTickets > 0) {
    attention.push({ severity: 'HIGH', what: `${maintenance.data.overdueTickets} Overdue PMs`, impact: 'Equipment degradation', action: 'View Maintenance' })
  }
  if (portfolio.data?.downAssets > 0) {
    attention.push({ severity: 'HIGH', what: `${portfolio.data.downAssets} Assets Down`, impact: 'Operational bottlenecks', action: 'View Assets' })
  }
  if (financial.data?.idleCapitalProxy > 0) {
    attention.push({ severity: 'MEDIUM', what: 'Idle Capital Detected', impact: 'Underutilized resources', action: 'View Idle Assets' })
  }
  if (!site.latitude || !site.longitude) {
    attention.push({ severity: 'MEDIUM', what: 'Missing Geofence Coordinates', impact: 'Location intelligence disabled', action: 'Edit Site' })
  }

  return {
    site,
    location,
    portfolio,
    financial,
    maintenance,
    health,
    risk,
    attention,
    generatedAt: new Date().toISOString()
  }
}


