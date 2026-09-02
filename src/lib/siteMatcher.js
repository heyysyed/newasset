/**
 * Utility to match site strings flexibly between assets and site master table.
 * Handles exact matches, case differences, hyphens vs underscores,
 * and project code prefix matches (e.g. "P148" matching "P148_AAKASA" and "P148 - AAKASHA WORLI").
 */
export function isSiteMatch(assetSite, siteObjOrName) {
  if (!assetSite || !siteObjOrName) return false
  const a = String(assetSite).trim()
  
  let s = ''
  let siteCode = null
  if (typeof siteObjOrName === 'object') {
    s = String(siteObjOrName.name || '').trim()
    siteCode = siteObjOrName.site_code ? String(siteObjOrName.site_code).trim() : null
  } else {
    s = String(siteObjOrName).trim()
  }

  // 0. Explicit site_code match
  if (siteCode && a.toUpperCase() === siteCode.toUpperCase()) return true

  // 1. Case-insensitive exact match
  if (a.toLowerCase() === s.toLowerCase()) return true

  // 2. Normalized string match (spaces, hyphens, underscores, brackets)
  const normA = a.replace(/[-_\[\]()]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  const normS = s.replace(/[-_\[\]()]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  if (normA === normS) return true

  // 3. Extract site code prefix (e.g., "P148", "[P148]", "P150")
  const getCode = (str) => {
    const cleanStr = str.replace(/^[\[\(]/, '') // remove leading bracket/paren
    const m = cleanStr.match(/^([A-Z0-9]+)[\s\-_\]\)]/i)
    return m ? m[1].toUpperCase() : null
  }
  const codeA = getCode(a)
  const codeS = getCode(s)
  if (codeA && codeS && codeA === codeS) return true

  // 4. Substring containment match
  if (normA.includes(normS) || normS.includes(normA)) return true

  return false
}


