import { createDomainContract, ConfidenceLevel, DomainStatus } from './intelligenceContract'

/**
 * Data Quality Engine
 * Calculates data quality score and identifies missing critical fields.
 */

export function calculateDataQuality(assets = []) {
  if (!assets || assets.length === 0) {
    return createDomainContract({
      status: DomainStatus.INSUFFICIENT_DATA,
      value: 0,
      recordCount: 0,
      source: 'assets',
      confidence: ConfidenceLevel.LOW,
      methodology: 'Cannot assess data quality without data.',
      data: {
        score: 0,
        completeRecords: 0,
        incompleteRecords: 0,
        missingFields: [],
        affectedAssets: [],
        affectedValue: 0
      }
    })
  }

  const criticalFields = ['asset_code', 'asset_name', 'category', 'site', 'status', 'purchase_value', 'useful_life_years', 'added_on']
  
  let totalScore = 0
  let completeRecords = 0
  let incompleteRecords = 0
  const missingFieldsCount = {}
  criticalFields.forEach(f => missingFieldsCount[f] = 0)
  
  const affectedAssets = []

  assets.forEach(asset => {
    let missingInThisAsset = 0
    let assetMissingFields = []
    
    criticalFields.forEach(field => {
      const val = asset[field]
      if (val === null || val === undefined || val === '' || val === 'N/A' || val === 0) {
        // exception: purchase_value of 0 might be valid for some very old scrap but generally implies missing financial data
        if (field === 'purchase_value' && val === 0) {
          missingInThisAsset++
          missingFieldsCount[field]++
          assetMissingFields.push(field)
        } else if (field !== 'purchase_value') {
          missingInThisAsset++
          missingFieldsCount[field]++
          assetMissingFields.push(field)
        }
      }
    })

    const recordScore = ((criticalFields.length - missingInThisAsset) / criticalFields.length) * 100
    totalScore += recordScore

    if (missingInThisAsset === 0) {
      completeRecords++
    } else {
      incompleteRecords++
      affectedAssets.push({
        id: asset.id,
        asset_code: asset.asset_code || 'UNKNOWN',
        asset_name: asset.asset_name || 'UNKNOWN',
        missingFields: assetMissingFields,
        purchase_value: asset.purchase_value || 0
      })
    }
  })

  const averageScore = Math.round(totalScore / assets.length)

  // Identify top critical missing fields
  const criticalMissingFields = Object.entries(missingFieldsCount)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([field, count]) => ({ field, count }))

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    value: averageScore,
    recordCount: assets.length,
    source: 'assets (critical fields check)',
    confidence: ConfidenceLevel.HIGH,
    methodology: `Evaluates ${criticalFields.length} critical fields across all assets. Only assesses core fields. Does not verify factual correctness.`,
    actions: [{ label: 'View Data Quality Report', route: '/admin/reports/data-quality-audit' }],
    data: {
      score: averageScore,
      completeRecords,
      incompleteRecords,
      missingFields: criticalMissingFields,
      affectedAssets,
      affectedValue: affectedAssets.reduce((sum, a) => sum + (Number(a.purchase_value) || 0), 0)
    }
  })
}


