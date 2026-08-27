/**
 * Asset Valuation & Depreciation Calculation Utilities
 * Supports Straight Line Method (SLM) & Written Down Value (WDV)
 */
import { formatCurrency } from '../depreciation'

/**
 * Calculates Net Book Value (NBV) & Accumulated Depreciation
 */
export function calculateAssetValuation(purchaseValue = 0, usefulLifeYears = 5, ageYears = 1, method = 'SLM', residualPct = 0.05) {
  const cost = Number(purchaseValue) || 0
  const life = Math.max(1, Number(usefulLifeYears) || 5)
  const age = Math.max(0, Number(ageYears) || 0)
  const salvage = cost * residualPct

  let accumDepr = 0

  if (method === 'WDV') {
    const rate = 1 - Math.pow(residualPct, 1 / life)
    let nbv = cost
    for (let i = 0; i < age && i < life; i++) {
      const depr = nbv * rate
      accumDepr += depr
      nbv -= depr
    }
  } else {
    // Default SLM
    const annualDepr = (cost - salvage) / life
    accumDepr = Math.min(cost - salvage, annualDepr * age)
  }

  const netBookValue = Math.max(salvage, cost - accumDepr)

  return {
    acquisitionCost: cost,
    accumulatedDepreciation: Math.round(accumDepr),
    netBookValue: Math.round(netBookValue),
    salvageValue: Math.round(salvage)
  }
}

/**
 * Calculates Gain/Loss on Asset Disposal
 */
export function calculateDisposalGainLoss(acquisitionCost, accumDepr, salvageProceeds) {
  const nbv = acquisitionCost - accumDepr
  const proceeds = Number(salvageProceeds) || 0
  const gainLoss = proceeds - nbv
  return {
    netBookValue: nbv,
    salvageProceeds: proceeds,
    gainLoss: gainLoss,
    isGain: gainLoss >= 0
  }
}

/**
 * Groups Assets into Construction Age Buckets
 */
export function getAssetAgeBucket(ageInYears) {
  const age = Number(ageInYears) || 0
  if (age < 1) return '< 1 Year'
  if (age <= 3) return '1 - 3 Years'
  if (age <= 5) return '3 - 5 Years'
  if (age <= 10) return '5 - 10 Years'
  return '> 10 Years'
}


