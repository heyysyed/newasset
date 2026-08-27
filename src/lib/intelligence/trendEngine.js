/**
 * Trend Engine
 * Safely compares current period vs previous comparable period.
 * Does not fabricate trends if historical data is missing.
 */

export function calculateTrend(currentValue, previousValue, minimumDataThreshold = 0) {
  if (previousValue === null || previousValue === undefined || isNaN(previousValue) || previousValue <= minimumDataThreshold) {
    return {
      available: false,
      message: 'Trend unavailable (insufficient historical data)',
      delta: null,
      percentageChange: null,
      direction: 'neutral'
    }
  }

  const delta = currentValue - previousValue
  let percentageChange = 0
  
  if (previousValue !== 0) {
    percentageChange = (delta / previousValue) * 100
  } else if (currentValue > 0) {
    percentageChange = 100 // Went from 0 to something
  }

  let direction = 'neutral'
  if (delta > 0) direction = 'up'
  if (delta < 0) direction = 'down'

  return {
    available: true,
    message: `${delta > 0 ? '+' : ''}${Math.round(percentageChange)}% vs previous period`,
    delta,
    percentageChange: Math.round(percentageChange * 10) / 10,
    direction
  }
}


