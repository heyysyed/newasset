import { isSiteMatch } from './siteMatcher'
import { supabase } from './supabase'

/**
 * 5-Stage Deterministic Waterfall Resolver for Sites
 * Matches short codes (P148), aliases (WORLI), prefixes (P148-CRN-001), fuzzy names, and exact names.
 *
 * @param {string} inputQuery Raw user string or excel field (e.g. "P148", "WORLI", "P158/VMD/01")
 * @param {Array} sitesList List of site objects fetched from database
 * @returns {Object} { matched: boolean, site: Object|null, site_id, site_name, site_code, matched_by }
 */
export function resolveSite(inputQuery, sitesList = []) {
  if (!inputQuery || typeof inputQuery !== 'string' && typeof inputQuery !== 'number') {
    return { matched: false, site: null, raw_input: inputQuery || '' }
  }

  const rawStr = String(inputQuery).trim()
  if (!rawStr) {
    return { matched: false, site: null, raw_input: '' }
  }

  const query = rawStr.toUpperCase()

  // 1. Stage 1: Exact Code Match (e.g. "P148" === "P148")
  const stage1 = sitesList.find(s => s.site_code && String(s.site_code).trim().toUpperCase() === query)
  if (stage1) {
    return {
      matched: true,
      site: stage1,
      site_id: stage1.id,
      site_name: stage1.name,
      site_code: stage1.site_code,
      matched_by: 'code'
    }
  }

  // 2. Stage 2: Alias Array Match (e.g. "WORLI" in site.aliases ['WORLI', 'AAKASA'])
  const stage2 = sitesList.find(s => 
    Array.isArray(s.aliases) && s.aliases.some(a => String(a).trim().toUpperCase() === query)
  )
  if (stage2) {
    return {
      matched: true,
      site: stage2,
      site_id: stage2.id,
      site_name: stage2.name,
      site_code: stage2.site_code || '',
      matched_by: 'alias'
    }
  }

  // 3. Stage 3: Asset Code / String Prefix Match (e.g. "P148-CRN-001" or "P158/VMD/02" or "CS_SCAFF_01")
  const prefixMatch = query.match(/^([A-Z0-9]+)[\s\-_/]/i)
  if (prefixMatch && prefixMatch[1]) {
    const prefix = prefixMatch[1].toUpperCase()
    const stage3 = sitesList.find(s => 
      (s.site_code && String(s.site_code).trim().toUpperCase() === prefix) ||
      (Array.isArray(s.aliases) && s.aliases.some(a => String(a).trim().toUpperCase() === prefix))
    )
    if (stage3) {
      return {
        matched: true,
        site: stage3,
        site_id: stage3.id,
        site_name: stage3.name,
        site_code: stage3.site_code || '',
        matched_by: 'prefix'
      }
    }
  }

  // 4. Stage 4: Fuzzy & Substring Match (e.g. "P148 AAKASHA" or "BALMORAL WORLI")
  const stage4 = sitesList.find(s => 
    isSiteMatch(rawStr, s.name) || (s.site_code && isSiteMatch(rawStr, s.site_code))
  )
  if (stage4) {
    return {
      matched: true,
      site: stage4,
      site_id: stage4.id,
      site_name: stage4.name,
      site_code: stage4.site_code || '',
      matched_by: 'fuzzy'
    }
  }

  // 5. Stage 5: Exact Name Match (case-insensitive)
  const stage5 = sitesList.find(s => s.name && String(s.name).trim().toUpperCase() === query)
  if (stage5) {
    return {
      matched: true,
      site: stage5,
      site_id: stage5.id,
      site_name: stage5.name,
      site_code: stage5.site_code || '',
      matched_by: 'name'
    }
  }

  return { matched: false, site: null, raw_input: rawStr }
}

/**
 * Permanently train the site record in Supabase with a new alias string.
 *
 * @param {string} siteId Site UUID
 * @param {string} newAlias Alias string to add (e.g. "ANJUR")
 * @param {Array} currentAliases Existing aliases array
 */
export async function addSiteAlias(siteId, newAlias, currentAliases = []) {
  if (!siteId || !newAlias || !newAlias.trim()) return null
  const cleanAlias = newAlias.trim().toUpperCase()
  
  const existingUpper = (currentAliases || []).map(a => String(a).toUpperCase())
  if (existingUpper.includes(cleanAlias)) return currentAliases

  const updatedAliases = [...(currentAliases || []), cleanAlias]
  const { data, error } = await supabase
    .from('sites')
    .update({ aliases: updatedAliases })
    .eq('id', siteId)
    .select()
    .single()

  if (error) {
    console.error('Failed to add site alias:', error)
    throw error
  }
  return data
}


