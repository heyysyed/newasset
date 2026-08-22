/**
 * Confidence Engine
 * Evaluates the confidence level of an intelligence metric based on data completeness.
 */

export const CONFIDENCE_LEVELS = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LIMITED: 'LIMITED'
}

export function determineConfidence({ sampleSize, totalPopulation, requiredFieldsMissing = 0, assumptionsMade = false, hasHistory = true }) {
  let score = 100

  // Penalty for low coverage
  if (totalPopulation > 0) {
    const coverage = sampleSize / totalPopulation
    if (coverage < 0.5) score -= 40
    else if (coverage < 0.8) score -= 20
  } else if (sampleSize === 0) {
    score = 0
  }

  // Penalty for missing critical fields in the dataset
  if (requiredFieldsMissing > 0) {
    score -= (requiredFieldsMissing * 10)
  }

  // Penalty for using proxies / assumptions
  if (assumptionsMade) {
    score -= 30
  }

  // Penalty for lack of history
  if (!hasHistory) {
    score -= 20
  }

  if (score >= 80) return { level: CONFIDENCE_LEVELS.HIGH, score, reason: 'High data coverage and completeness. Metrics are directly traceable to source records.' }
  if (score >= 50) return { level: CONFIDENCE_LEVELS.MEDIUM, score, reason: 'Moderate data completeness. Some fields are estimated or use proxy calculations. Interpret with caution.' }
  return { level: CONFIDENCE_LEVELS.LIMITED, score, reason: 'Insufficient data coverage or significant missing fields. Metrics should be treated as directional only.' }

}
