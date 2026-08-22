import { createDomainContract, ConfidenceLevel, DomainStatus } from './intelligenceContract'

/**
 * Normalizes location information for an asset, distinguishing between EXACT coordinates
 * and SITE_LEVEL inherited coordinates.
 * 
 * @param {Object} asset - The asset object from the database.
 * @param {Object} siteObj - The site object the asset belongs to (optional, fetched via join or separate query).
 * @param {Array} movements - Array of asset movements sorted descending by date.
 */
export function resolveAssetLocation(asset, siteObj = null, movements = []) {
  let latitude = null
  let longitude = null
  let precision = 'UNKNOWN'
  let source = 'NONE'
  let siteName = siteObj?.name || asset.site || 'Unknown Site'
  let siteId = siteObj?.id || null

  // 1. Check if asset has exact coordinates
  if (asset.latitude && asset.longitude) {
    latitude = asset.latitude
    longitude = asset.longitude
    precision = 'EXACT'
    source = 'ASSET'
  } 
  // 2. Fallback to site coordinates
  else if (siteObj && siteObj.latitude && siteObj.longitude) {
    latitude = siteObj.latitude
    longitude = siteObj.longitude
    precision = 'SITE_LEVEL'
    source = 'SITE'
  }

  // 3. Movement context
  let lastKnownLocation = null
  let locationUpdatedAt = null
  let previousSite = null
  let movementSource = null

  if (movements && movements.length > 0) {
    // Assuming movements are sorted newest first
    const latestMovement = movements[0]
    locationUpdatedAt = latestMovement.moved_at || latestMovement.created_at
    previousSite = latestMovement.from_site
    movementSource = 'MOVEMENT_RECORD'
  }

  return {
    assetId: asset.id,
    siteId,
    siteName,
    latitude,
    longitude,
    precision, // 'EXACT' | 'SITE_LEVEL' | 'UNKNOWN'
    source, // 'ASSET' | 'SITE' | 'NONE'
    lastKnownLocation,
    locationUpdatedAt,
    previousSite,
    movementSource
  }
}

export function buildLocationIntelligenceContract(locationResolution) {
  const isMapped = locationResolution.precision !== 'UNKNOWN'
  
  return createDomainContract({
    status: isMapped ? DomainStatus.SUCCESS : DomainStatus.INSUFFICIENT_DATA,
    confidence: locationResolution.precision === 'EXACT' ? ConfidenceLevel.HIGH : 
                (locationResolution.precision === 'SITE_LEVEL' ? ConfidenceLevel.MEDIUM : ConfidenceLevel.LIMITED),
    source: locationResolution.source,
    methodology: 'Location resolved sequentially: Exact Coordinates > Site Coordinates.',
    data: locationResolution
  })
}
