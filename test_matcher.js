
const isSiteMatch = (assetSite, siteName) => {
  if (!assetSite || !siteName) return false
  const a = String(assetSite).trim()
  const s = String(siteName).trim()

  const normA = a.replace(/[-_\[\]()]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  const normS = s.replace(/[-_\[\]()]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  if (normA === normS) return true

  const getCode = (str) => {
    const cleanStr = str.replace(/^[\[\(]/, '')
    const m = cleanStr.match(/^([A-Z0-9]+)[\s\-_\]\)]/i)
    return m ? m[1].toUpperCase() : null
  }
  const codeA = getCode(a)
  const codeS = getCode(s)
  
  console.log({ a, s, codeA, codeS })
  if (codeA && codeS && codeA === codeS) return true
  if (normA.includes(normS) || normS.includes(normA)) return true

  return false
}

console.log('Result:', isSiteMatch('P148', '[P148] AAKASA'));
console.log('Result:', isSiteMatch('P148 - AAKASA', '[P148] AAKASA'));
console.log('Result:', isSiteMatch('[P148] AAKASA', '[P148] AAKASA'));
console.log('Result:', isSiteMatch('P148_AAKASA', '[P148] AAKASA'));
console.log('Result:', isSiteMatch('P158 - P158 BALMORAL', '[P158] BALMORAL'));
console.log('Result:', isSiteMatch('Project Site A', '[P158] BALMORAL'));

