import { createDomainContract, ConfidenceLevel, DomainStatus } from './intelligenceContract'

/**
 * Portfolio Health Engine
 * Calculates a 0-100 deterministic health score based on operational metrics.
 */

export const HEALTH_WEIGHTS = {
  asset: 25,
  maintenance: 30,
  inventory: 20,
  financial: 15,
  dataQuality: 10
}

export function calculatePortfolioHealth({
  assets = [],
  maintenanceIntelligence,
  financialIntelligence,
  dataQualityIntelligence,
  inventoryIntelligence
}) {
  if (!assets || assets.length === 0) {
    return createDomainContract({
      status: DomainStatus.INSUFFICIENT_DATA,
      value: null,
      source: 'Cross-domain',
      confidence: ConfidenceLevel.LOW,
      methodology: 'Cannot calculate portfolio health without asset data.',
      data: { score: 0, components: {} }
    })
  }

  let assetHealth = 100
  let maintenanceHealth = 100
  let inventoryHealth = 100
  let financialHealth = 100
  let dataHealth = dataQualityIntelligence?.data?.score || 0

  let assetEvidence = 'Asset operational status is stable.'
  let maintenanceEvidence = 'Maintenance data is unavailable.'
  let inventoryEvidence = 'Inventory data is unavailable.'
  let financialEvidence = 'Financial data is unavailable.'
  let dataEvidence = dataQualityIntelligence?.methodology || 'Data quality is unavailable.'

  // 1. Asset Health
  const downAssets = assets.filter(a => a.status === 'Down' || a.status === 'Under Repair').length
  const poorAssets = assets.filter(a => a.condition === 'Poor').length
  const totalAssets = assets.length
  
  if (totalAssets > 0) {
    const downPenalty = (downAssets / totalAssets) * 100 * 2 // Down assets hurt twice as much
    const poorPenalty = (poorAssets / totalAssets) * 100
    assetHealth = Math.max(0, 100 - downPenalty - poorPenalty)
    
    if (downAssets > 0 || poorAssets > 0) {
      assetEvidence = `${downAssets} assets are down/repairing and ${poorAssets} are in poor condition.`
    }
  }

  // 2. Maintenance Health
  if (maintenanceIntelligence && maintenanceIntelligence.data) {
    const { backlogCount, criticalCount, pmCompliance, repeatFailuresCount } = maintenanceIntelligence.data
    
    const criticalPenalty = Math.min(40, criticalCount * 5)
    const backlogPenalty = Math.min(30, (backlogCount / 50) * 30)
    const pmPenalty = pmCompliance ? Math.max(0, 100 - pmCompliance.score) * 0.5 : 0
    const repeatPenalty = Math.min(20, repeatFailuresCount * 5)

    maintenanceHealth = Math.max(0, 100 - criticalPenalty - backlogPenalty - pmPenalty - repeatPenalty)
    
    if (criticalCount > 0 || pmPenalty > 0) {
      maintenanceEvidence = `${criticalCount} critical backlog items and PM compliance is ${pmCompliance ? pmCompliance.score : 0}%.`
    } else {
      maintenanceEvidence = 'Maintenance operations are stable.'
    }
  }

  // 3. Inventory Health
  if (inventoryIntelligence && inventoryIntelligence.data) {
    const { stockoutItemsCount, lowStockItemsCount } = inventoryIntelligence.data
    const stockoutPenalty = Math.min(50, stockoutItemsCount * 5)
    const lowStockPenalty = Math.min(30, lowStockItemsCount * 2)
    inventoryHealth = Math.max(0, 100 - stockoutPenalty - lowStockPenalty)
    
    if (stockoutItemsCount > 0 || lowStockItemsCount > 0) {
      inventoryEvidence = `${stockoutItemsCount} stockouts and ${lowStockItemsCount} low stock items.`
    } else {
      inventoryEvidence = 'Inventory levels are stable.'
    }
  }

  // 4. Financial Health (Capital Efficiency)
  if (financialIntelligence && financialIntelligence.data) {
    const { grossAssetValue, idleCapital, atRiskCapital } = financialIntelligence.data
    if (grossAssetValue > 0) {
      const idlePenalty = (idleCapital / grossAssetValue) * 100 * 1.5
      const riskPenalty = (atRiskCapital / grossAssetValue) * 100
      financialHealth = Math.max(0, 100 - idlePenalty - riskPenalty)
      
      if (idleCapital > 0 || atRiskCapital > 0) {
        financialEvidence = `${Math.round((idleCapital/grossAssetValue)*100)}% capital is idle, ${Math.round((atRiskCapital/grossAssetValue)*100)}% is at risk.`
      } else {
        financialEvidence = 'Capital utilization is efficient.'
      }
    }
  }

  // Normalize scores
  assetHealth = Math.round(assetHealth)
  maintenanceHealth = Math.round(maintenanceHealth)
  inventoryHealth = Math.round(inventoryHealth)
  financialHealth = Math.round(financialHealth)
  dataHealth = Math.round(dataHealth)

  const overallScore = Math.round(
    (assetHealth * (HEALTH_WEIGHTS.asset / 100)) +
    (maintenanceHealth * (HEALTH_WEIGHTS.maintenance / 100)) +
    (inventoryHealth * (HEALTH_WEIGHTS.inventory / 100)) +
    (financialHealth * (HEALTH_WEIGHTS.financial / 100)) +
    (dataHealth * (HEALTH_WEIGHTS.dataQuality / 100))
  )

  const confidence = assets.length > 0 ? ConfidenceLevel.HIGH : ConfidenceLevel.MEDIUM

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    value: overallScore,
    recordCount: assets.length,
    source: 'Aggregated from all domains',
    confidence,
    methodology: 'Weighted deterministic model combining operational, financial, and data quality metrics.',
    data: {
      score: overallScore,
      components: {
        asset: { score: assetHealth, weight: HEALTH_WEIGHTS.asset, status: assetHealth > 75 ? 'Healthy' : 'Warning', evidence: assetEvidence },
        maintenance: { score: maintenanceHealth, weight: HEALTH_WEIGHTS.maintenance, status: maintenanceHealth > 75 ? 'Healthy' : 'Warning', evidence: maintenanceEvidence },
        inventory: { score: inventoryHealth, weight: HEALTH_WEIGHTS.inventory, status: inventoryHealth > 75 ? 'Healthy' : 'Warning', evidence: inventoryEvidence },
        financial: { score: financialHealth, weight: HEALTH_WEIGHTS.financial, status: financialHealth > 75 ? 'Healthy' : 'Warning', evidence: financialEvidence },
        dataQuality: { score: dataHealth, weight: HEALTH_WEIGHTS.dataQuality, status: dataHealth > 75 ? 'Healthy' : 'Warning', evidence: dataEvidence }
      }
    }
  })
}


