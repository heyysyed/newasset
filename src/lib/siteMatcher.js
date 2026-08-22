/**
 * Utility to match site strings flexibly between assets and site master table.
 * Handles exact matches, case differences, hyphens vs underscores,
 * and project code prefix matches (e.g. "P148" matching "P148_AAKASA" and "P148 - AAKASHA WORLI").
 */
export function isSiteMatch(assetSite, siteName) {
  if (!assetSite || !siteName) return false
  const a = String(assetSite).trim()
  const s = String(siteName).trim()

  // 1. Case-insensitive exact match
  if (a.toLowerCase() === s.toLowerCase()) return true

  // 2. Normalized string match (spaces, hyphens, underscores)
  const normA = a.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').toLowerCase()
  const normS = s.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').toLowerCase()
  if (normA === normS) return true

  // 3. Extract site code prefix (e.g., "P148", "P149", "P150", "P100")
  const getCode = (str) => {
    const m = str.match(/^([A-Z0-9]+)[\s\-_]/i)
    return m ? m[1].toUpperCase() : null
  }
  const codeA = getCode(a)
  const codeS = getCode(s)
  if (codeA && codeS && codeA === codeS) return true

  // 4. Substring containment match
  if (normA.includes(normS) || normS.includes(normA)) return true

  return false
}
