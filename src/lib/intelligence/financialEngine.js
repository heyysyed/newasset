import { createDomainContract, ConfidenceLevel, DomainStatus } from './intelligenceContract'

/**
 * Financial Intelligence Engine
 * Calculates financial exposure, idle capital, and net book value.
 */

export function calculateFinancialIntelligence(assets = []) {
  if (!assets || assets.length === 0) {
    return createDomainContract({
      status: DomainStatus.INSUFFICIENT_DATA,
      value: 0,
      recordCount: 0,
      source: 'assets',
      confidence: ConfidenceLevel.LOW,
      methodology: 'No assets found to calculate financial metrics.',
      data: {
        grossAssetValue: 0,
        netBookValue: 0,
        depreciationExposure: 0,
        idleCapital: 0,
        atRiskCapital: 0
      }
    })
  }

  let grossAssetValue = 0
  let netBookValue = 0
  let depreciationExposure = 0
  let idleCapital = 0
  let atRiskCapital = 0
  let recordsWithPurchaseValue = 0

  const idleAssets = []
  const riskAssets = []

  assets.forEach(asset => {
    const purchaseVal = Number(asset.purchase_value)
    if (!isNaN(purchaseVal) && purchaseVal > 0) recordsWithPurchaseValue++
    const pVal = purchaseVal || 0
    grossAssetValue += pVal
    
    // Quick NBV Calc (simplified straight line for intelligence)
    const salvageVal = Number(asset.salvage_value) || 0
    const usefulLife = Number(asset.useful_life_years) || 10
    const pDateStr = asset.purchase_date || asset.added_on || asset.created_at
    let yearsOwned = 0
    
    if (pDateStr) {
      yearsOwned = Math.max(0, (new Date() - new Date(pDateStr)) / (1000 * 60 * 60 * 24 * 365.25))
    }
    
    const annualDepr = (pVal - salvageVal) / Math.max(1, usefulLife)
    const accumDepr = Math.min(pVal - salvageVal, annualDepr * yearsOwned)
    const assetNbv = Math.max(salvageVal, pVal - accumDepr)
    
    netBookValue += assetNbv
    depreciationExposure += accumDepr

    // Idle Capital Check
    if ((asset.status === 'Idle' || asset.status === 'Down' || asset.status === 'In Storage') && assetNbv > 0) {
      idleCapital += assetNbv
      idleAssets.push({ ...asset, current_nbv: assetNbv })
    }

    // At Risk Capital
    if ((asset.condition === 'Poor' || asset.condition === 'End of Life' || asset.status === 'Down') && assetNbv > 0) {
      atRiskCapital += assetNbv
      riskAssets.push({ ...asset, current_nbv: assetNbv })
    }
  })

  const confidence = (recordsWithPurchaseValue / assets.length) > 0.8 ? ConfidenceLevel.HIGH : ((recordsWithPurchaseValue / assets.length) > 0.4 ? ConfidenceLevel.MEDIUM : ConfidenceLevel.LOW)

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    value: Math.round(grossAssetValue),
    recordCount: assets.length,
    source: 'assets (purchase_value, salvage_value, useful_life_years)',
    confidence,
    methodology: 'Estimated Net Book Value is calculated using simplified straight-line depreciation for intelligence purposes, not accounting ledger exactness. Idle Capital is a proxy based on NBV of inactive assets.',
    actions: [{ label: 'View Asset Valuations', route: '/admin/reports/asset-valuation-chart' }],
    data: {
      grossAssetValue: Math.round(grossAssetValue),
      netBookValue: Math.round(netBookValue),
      depreciationExposure: Math.round(depreciationExposure),
      idleCapital: Math.round(idleCapital),
      atRiskCapital: Math.round(atRiskCapital),
      idleAssetsCount: idleAssets.length,
      riskAssetsCount: riskAssets.length
    }
  })
}
