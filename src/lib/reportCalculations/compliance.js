/**
 * Compliance & Warranty Expiry Bucketing Utility
 */

/**
 * Calculates days to expiry & assigns Expiry Bucket
 */
export function getExpiryBucket(expiryDateStr) {
  if (!expiryDateStr) return { bucket: 'UNKNOWN', daysRemaining: 0, isExpired: false }

  const target = new Date(expiryDateStr)
  const today = new Date()
  const diffTime = target.getTime() - today.getTime()
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  let bucket = '> 90 Days'
  let isExpired = false

  if (daysRemaining < 0) {
    bucket = 'Expired'
    isExpired = true
  } else if (daysRemaining <= 7) {
    bucket = '0 - 7 Days'
  } else if (daysRemaining <= 30) {
    bucket = '8 - 30 Days'
  } else if (daysRemaining <= 60) {
    bucket = '31 - 60 Days'
  } else if (daysRemaining <= 90) {
    bucket = '61 - 90 Days'
  }

  return {
    bucket,
    daysRemaining,
    isExpired
  }
}


