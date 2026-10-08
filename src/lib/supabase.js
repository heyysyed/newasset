import { enqueueOffline, drainOffline } from './offlineQueue'
import { validateDocument } from './safeInput'
import { createClient } from '@supabase/supabase-js'
import { isSiteMatch } from './siteMatcher'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'
)

// ── ACTIVITY LOG ─────────────────────────────────────────
export async function logActivity(userId, action, entityType, entityId, entityName, details = {}) {
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId, action, entity_type: entityType,
      entity_id: entityId, entity_name: entityName, details,
    })
  } catch (e) { console.error('Activity log error:', e) }
}

export async function fetchActivityLogs(limit = 100, offset = 0, filters = {}) {
  let q = supabase.from('activity_logs')
    .select('*, profiles:user_id(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (filters.entity_type) q = q.eq('entity_type', filters.entity_type)
  if (filters.user_id) q = q.eq('user_id', filters.user_id)
  if (filters.action) q = q.eq('action', filters.action)
  if (filters.search) q = q.or(`entity_name.ilike.%${filters.search}%,action.ilike.%${filters.search}%`)
  const { data, error, count } = await q
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

// ── AUTH ──────────────────────────────────────────────────
export async function signIn(email, password) {
  const result = await supabase.auth.signInWithPassword({ email, password })
  if (result.data?.user) await logActivity(result.data.user.id, 'signed_in', 'auth', result.data.user.id, email)
  return result
}

export const signUp = (email, password, meta = {}) =>
  supabase.auth.signUp({ email, password, options: { data: meta } })

export async function signOut() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) await logActivity(session.user.id, 'signed_out', 'auth', session.user.id, session.user.email)
  return supabase.auth.signOut()
}

export const getSession = () => supabase.auth.getSession()

// ── ADMIN USER CREATION ───────────────────────────────────
export async function adminCreateUser({ email, password, full_name, role }) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password, full_name, role }),
    }
  )
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to create user')
  await logActivity(null, 'created', 'user', json.user?.id, full_name, { email, role })
  return json.user
}

// ── PROFILES ─────────────────────────────────────────────
export async function getProfile(uid) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single()
  if (error) throw error
  return data
}

export async function getAllProfiles(callerRole = 'user') {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at')
  if (error) throw error
  // Hide super_admin profiles from everyone except super_admin
  if (callerRole !== 'super_admin') {
    return (data || []).filter(p => p.role !== 'super_admin')
  }
  return data
}

// Get QR scan config
export async function getQrScanConfig() {
  const { data, error } = await supabase.from('app_settings').select('qr_scan_config').eq('id', 1).single()
  if (error) throw error
  return data?.qr_scan_config || {}
}

// Update QR scan config (super_admin only)
export async function updateQrScanConfig(config) {
  const { data, error } = await supabase.from('app_settings').update({ qr_scan_config: config }).eq('id', 1).select().single()
  if (error) throw error
  return data
}

export async function updateProfile(uid, updates) {
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', uid).select().single()
  if (error) throw error
  await logActivity(uid, 'updated', 'profile', uid, data.full_name, { fields: Object.keys(updates) })
  return data
}

// ── APP SETTINGS ─────────────────────────────────────────
export async function getSettings() {
  const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

export async function updateSettings(updates) {
  const { data, error } = await supabase.from('app_settings').update(updates).eq('id', 1).select().single()
  if (error) throw error
  await logActivity(null, 'updated', 'settings', '1', 'App Settings', { fields: Object.keys(updates) })
  return data
}

export const getAssetSelectCols = (canViewFinancials = false) => {
  const base = 'id, asset_code, asset_name, make, model_no, purchase_order_no, serial_no, capacity, status, category, site, type_code, purchase_date, location, department, assigned_to, notes, custom_fields, latitude, longitude, warranty_expiry, disposal_date, disposal_reason, checklist_template_id, quantity, parent_asset_id, nfc_tag_id, added_on, updated_at, added_by'
  const fin = ', purchase_value, salvage_value, useful_life_years, depreciation_method, depreciation_rate_percent'
  return canViewFinancials ? `${base}${fin}` : base
}

// ── ASSETS ───────────────────────────────────────────────
export async function fetchAssets(filters = {}, cc, selectCols = '*') {
  let q = supabase.from('assets').select(selectCols).order('added_on', { ascending: false }).or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
  if (cc) q = q.eq('company_code', cc)
  if (filters.status   && filters.status !== 'All') q = q.eq('status', filters.status)
  if (filters.category && filters.category !== 'All') q = q.eq('category', filters.category)
  if (filters.site && filters.site !== 'All') {
    const codeMatch = filters.site.match(/^([A-Z0-9]+)[\s\-_]/i)
    if (codeMatch) {
      q = q.or(`site.eq.${filters.site},site.ilike.${codeMatch[1]}%`)
    } else {
      q = q.ilike('site', `%${filters.site}%`)
    }
  }
  if (filters.search)  q = q.or(`asset_code.ilike.%${filters.search}%,asset_name.ilike.%${filters.search}%,make.ilike.%${filters.search}%,site.ilike.%${filters.search}%`)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function fetchAsset(id, selectCols = '*') {
  const { data, error } = await supabase.from('assets')
    .select(`${selectCols}, profiles!assigned_to(id, full_name, email), employees!assigned_employee_id(id, employee_code, full_name, email, department)`)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createAsset(asset, userId) {
  const { data, error } = await supabase.from('assets').insert([{ ...asset, added_by: userId }]).select().single()
  if (error) throw error
  await logAudit(data.id, userId, 'created', asset)
  await logActivity(userId, 'created', 'asset', data.id, asset.asset_name || asset.asset_code, { asset_code: asset.asset_code, category: asset.category })
  return data
}

export async function updateAsset(id, updates, userId) {
  const { data, error } = await supabase.from('assets').update(updates).eq('id', id).select().single()
  if (error) throw error
  await logAudit(id, userId, 'updated', updates)
  await logActivity(userId, 'updated', 'asset', id, data.asset_name, { fields: Object.keys(updates) })
  return data
}

export async function updateAssetWithConcurrency(id, updates, userId, expectedVersion = 1) {
  const { data, error } = await supabase
    .from('assets')
    .update({ ...updates, record_version: expectedVersion + 1 })
    .eq('id', id)
    .eq('record_version', expectedVersion)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('409 CONFLICT: Asset record was modified by another administrator. Please reload the latest data.')
  }
  await logAudit(id, userId, 'updated', updates)
  await logActivity(userId, 'updated', 'asset', id, data[0].asset_name, { fields: Object.keys(updates), record_version: expectedVersion + 1 })
  return data[0]
}

export async function verifyServerAuditChain() {
  const { data, error } = await supabase.rpc('fn_verify_audit_chain_integrity')
  if (error) throw error
  return data
}

export async function updateAssetLocation(assetId, lat, lng) {
  const { error } = await supabase.rpc('update_asset_location', {
    p_asset_id: assetId,
    p_lat: lat,
    p_lng: lng
  })
  if (error) throw error
}

// Archive RPCs keep dependent photos, movements, inspections, and history intact.
// Missing migrations must fail closed; never fall back to destructive browser deletes.
export async function deleteAsset(id) {
  return bulkDeleteAssets([id])
}

export async function bulkDeleteAssets(ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 500) {
    throw new Error('Select between 1 and 500 assets to archive at a time.')
  }
  const { data, error } = await supabase.rpc('archive_assets', { p_ids: ids })
  if (error) throw error
  return data
}

export async function fetchDeletedAssets() {
  const { data, error } = await supabase.rpc('list_archived_assets')
  if (error) throw error
  return data || []
}

export async function restoreAsset(id) {
  const { data, error } = await supabase.rpc('restore_archived_asset', { p_id: id })
  if (error) throw error
  return data
}

export async function permanentlyDeleteAsset() {
  throw new Error('Permanent deletion requires an administrator-managed retention process and a verified backup.')
}

export async function fetchPublicAsset(id) {
  const { data, error } = await supabase.rpc('get_public_asset', { p_id: id })
  if (error) throw error
  return data
}

export async function bulkUpdateAssets(ids, updates, userId) {
  const CHUNK = 200
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = ids.slice(i, i + CHUNK)
    const { error } = await supabase.from('assets').update(updates).in('id', batch)
    if (error) throw error
  }
  await supabase.from('asset_audit').insert(
    ids.map(id => ({ asset_id: id, user_id: userId, action: 'bulk_updated', changes: updates }))
  )
  await logActivity(userId, 'bulk_updated', 'asset', null, `${ids.length} assets`, { count: ids.length, updates })
}

let _sitesCache = null
let _sitesCacheTime = 0
const SITES_CACHE_TTL = 60000 // 1 min

async function getCachedSites() {
  const now = Date.now()
  if (_sitesCache && (now - _sitesCacheTime < SITES_CACHE_TTL)) {
    return _sitesCache
  }
  try {
    const { data } = await supabase.from('sites').select('id, name, site_code, aliases')
    _sitesCache = data || []
    _sitesCacheTime = now
    return _sitesCache
  } catch (e) {
    return _sitesCache || []
  }
}

export async function fetchAssetsPaginated(filters = {}, page = 0, pageSize = 50, cc = null, selectCols = '*') {
  const from = page * pageSize
  const to = from + pageSize - 1

  const activeTerm = filters.site && filters.site !== 'All' 
    ? filters.site.replace(/^\[[A-Z0-9]+\]\s*/i, '').trim() 
    : (filters.search ? filters.search.trim() : '')

  let siteSearchTerms = []
  if (activeTerm) {
    const termUpper = activeTerm.toUpperCase()
    const allSites = await getCachedSites()
    allSites.forEach(s => {
      const nameMatch = s.name && s.name.toUpperCase().includes(termUpper)
      const codeMatch = s.site_code && s.site_code.toUpperCase().includes(termUpper)
      const aliasMatch = Array.isArray(s.aliases) && s.aliases.some(a => String(a).toUpperCase().includes(termUpper))
      if (nameMatch || codeMatch || aliasMatch) {
        if (s.name) siteSearchTerms.push(s.name)
        if (s.site_code) siteSearchTerms.push(s.site_code)
        if (Array.isArray(s.aliases)) siteSearchTerms.push(...s.aliases)
      }
    })
  }

  let q = supabase.from('assets')
    .select(`${selectCols}, profiles!assigned_to(id, full_name, email), employees!assigned_employee_id(id, employee_code, full_name, email, department)`, { count: 'exact' })
    .or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
    .order('added_on', { ascending: false })
    .range(from, to)

  if (cc) q = q.eq('company_code', cc)
  if (filters.status && filters.status !== 'All') q = q.eq('status', filters.status)
  if (filters.category && filters.category !== 'All') q = q.eq('category', filters.category)

  if (filters.site && filters.site !== 'All') {
    const cleanSite = filters.site.replace(/^\[[A-Z0-9]+\]\s*/i, '').trim()
    const orConditions = [`site.ilike.%${cleanSite}%`]
    const codeMatch = cleanSite.match(/^([A-Z0-9]+)/i)
    if (codeMatch) orConditions.push(`site.ilike.%${codeMatch[1]}%`)
    siteSearchTerms.forEach(st => orConditions.push(`site.ilike.%${st}%`))
    q = q.or([...new Set(orConditions)].join(','))
  }

  if (filters.search) {
    const s = filters.search.trim()
    const searchConditions = [
      `asset_code.ilike.%${s}%`,
      `asset_name.ilike.%${s}%`,
      `make.ilike.%${s}%`,
      `model_no.ilike.%${s}%`,
      `serial_no.ilike.%${s}%`,
      `site.ilike.%${s}%`
    ]
    siteSearchTerms.forEach(st => searchConditions.push(`site.ilike.%${st}%`))
    q = q.or([...new Set(searchConditions)].join(','))
  }

  const { data, error, count } = await q
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

// ── Child Assets (Parent-Child Hierarchy) ──────────────
export async function fetchChildAssets(parentId) {
  const { data, error } = await supabase.from('assets')
    .select('id, asset_code, asset_name, make, model_no, status, category, site')
    .eq('parent_asset_id', parentId)
    .order('asset_name')
  if (error) throw error
  return data || []
}

export async function linkChildAsset(parentId, childId, userId) {
  const { data, error } = await supabase.from('assets').update({ parent_asset_id: parentId }).eq('id', childId).select().single()
  if (error) throw error
  await logAudit(childId, userId, 'linked_to_parent', { parent_asset_id: parentId })
  await logActivity(userId, 'linked_child', 'asset', parentId, data.asset_name, { child_id: childId, child_code: data.asset_code })
  return data
}

export async function unlinkChildAsset(childId, userId) {
  const { data: child } = await supabase.from('assets').select('asset_name, asset_code, parent_asset_id').eq('id', childId).single()
  const { data, error } = await supabase.from('assets').update({ parent_asset_id: null }).eq('id', childId).select().single()
  if (error) throw error
  await logAudit(childId, userId, 'unlinked_from_parent', { old_parent_id: child?.parent_asset_id })
  await logActivity(userId, 'unlinked_child', 'asset', child?.parent_asset_id, child?.asset_name, { child_id: childId })
  return data
}

export async function searchAssetsForLinking(search, excludeIds = []) {
  let q = supabase.from('assets')
    .select('id, asset_code, asset_name, status, category, site')
    .is('parent_asset_id', null)
    .or(`asset_code.ilike.%${search}%,asset_name.ilike.%${search}%`)
    .limit(10)
  if (excludeIds.length) q = q.not('id', 'in', `(${excludeIds.join(',')})`)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// ── Asset Photos ────────────────────────────────────────
export async function fetchAssetPhotos(assetId) {
  const { data, error } = await supabase.from('asset_photos').select('*').eq('asset_id', assetId).order('created_at')
  if (error) throw error
  return data || []
}

export async function uploadAssetPhoto(assetId, file, caption, userId) {
  const path = `asset-photos/${assetId}/${Date.now()}.jpg`
  const { error: upErr } = await supabase.storage.from('checklist-uploads').upload(path, file, { contentType: file.type || 'image/jpeg' })
  if (upErr) throw upErr
  const { data: { publicUrl } } = supabase.storage.from('checklist-uploads').getPublicUrl(path)
  const { data, error } = await supabase.from('asset_photos').insert({ asset_id: assetId, photo_url: publicUrl, caption, uploaded_by: userId }).select().single()
  if (error) throw error
  return data
}

export async function deleteAssetPhoto(photoId) {
  const { error } = await supabase.from('asset_photos').delete().eq('id', photoId)
  if (error) throw error
}

// ── Asset Attachments ───────────────────────────────────
export async function fetchAssetAttachments(assetId) {
  const { data, error } = await supabase.from('asset_attachments').select('*').eq('asset_id', assetId).order('created_at')
  if (error) throw error
  return data || []
}

export async function uploadAssetAttachment(assetId, file, userId) {
  validateDocument(file)
  const path = `asset-attachments/${assetId}/${Date.now()}-${file.name}`
  const { error: upErr } = await supabase.storage.from('checklist-uploads').upload(path, file, { contentType: file.type })
  if (upErr) throw upErr
  const { data: { publicUrl } } = supabase.storage.from('checklist-uploads').getPublicUrl(path)
  const { data, error } = await supabase.from('asset_attachments').insert({
    asset_id: assetId, file_url: publicUrl, file_name: file.name, file_type: file.type, file_size: file.size, uploaded_by: userId
  }).select().single()
  if (error) throw error
  return data
}

export async function deleteAssetAttachment(attachId) {
  const { error } = await supabase.from('asset_attachments').delete().eq('id', attachId)
  if (error) throw error
}

export async function logMovement(assetId, userId, fromLoc, toLoc, notes, type = 'transfer') {
  const { error } = await supabase.from('asset_movements').insert([{
    asset_id: assetId,
    moved_by: userId,
    movement_type: type,
    from_location: fromLoc,
    to_location: toLoc,
    notes: notes
  }])
  if (error) throw error
}

export async function transferAsset(id, userId, fromSite, toSite, notes) {
  const { data, error } = await supabase.from('assets').update({ site: toSite }).eq('id', id).select().single()
  if (error) throw error
  await logMovement(id, userId, fromSite, toSite, notes)
  await logAudit(id, userId, 'transferred', { from: fromSite, to: toSite, notes })
  await logActivity(userId, 'transferred', 'asset', id, data.asset_name, { from: fromSite, to: toSite })
  return data
}

// Bulk / partial quantity transfer — calls the atomic Postgres function
export async function bulkTransferAsset(sourceAssetId, transferQty, toSite, userId, notes) {
  const { data, error } = await supabase.rpc('bulk_transfer_asset', {
    p_source_asset_id: sourceAssetId,
    p_transfer_qty: transferQty,
    p_to_site: toSite,
    p_user_id: userId,
    p_notes: notes || null,
  })
  if (error) throw error
  await logActivity(userId, 'bulk_transferred', 'asset', sourceAssetId, `Qty ${transferQty} → ${toSite}`, { to_site: toSite, qty: transferQty, dest_asset_id: data })
  return data // destination asset ID
}

export async function deleteAuditSession(id) {
  const { data: s } = await supabase.from('audit_sessions').select('title').eq('id', id).single()
  await supabase.from('audit_items').delete().eq('session_id', id)
  const { error } = await supabase.from('audit_sessions').delete().eq('id', id)
  if (error) throw error
  await logActivity(null, 'deleted', 'audit_session', id, s?.title || id)
}

// ── AUDIT HELPERS ───────────────────────────────────────

export async function fetchAuditHistoryForAsset(assetId) {
  const { data, error } = await supabase
    .from('audit_items')
    .select('*, audit_sessions(title, created_at, status), profiles:checked_by(full_name)')
    .eq('asset_id', assetId)
    .order('checked_at', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data || []
}

export async function bulkUpdateAuditItems(itemIds, result, userId) {
  const CHUNK = 200
  const checked_at = result === 'unverified' ? null : new Date().toISOString()
  for (let i = 0; i < itemIds.length; i += CHUNK) {
    const batch = itemIds.slice(i, i + CHUNK)
    const { error } = await supabase.from('audit_items')
      .update({ result, checked_by: userId, checked_at })
      .in('id', batch)
    if (error) throw error
  }
}

export async function uploadAuditPhoto(sessionId, itemId, file) {
  const path = `audit-evidence/${sessionId}/${itemId}/${Date.now()}.jpg`
  const { error: upErr } = await supabase.storage
    .from('checklist-uploads')
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
  if (upErr) throw upErr
  const { data: { publicUrl } } = supabase.storage.from('checklist-uploads').getPublicUrl(path)
  // Append URL to the item's photo_urls array
  const { data: item } = await supabase.from('audit_items').select('photo_urls').eq('id', itemId).single()
  const urls = [...(item?.photo_urls || []), publicUrl]
  const { error } = await supabase.from('audit_items').update({ photo_urls: urls }).eq('id', itemId)
  if (error) throw error
  return { publicUrl, urls }
}

export async function removeAuditPhoto(itemId, urlToRemove) {
  const { data: item } = await supabase.from('audit_items').select('photo_urls').eq('id', itemId).single()
  const urls = (item?.photo_urls || []).filter(u => u !== urlToRemove)
  const { error } = await supabase.from('audit_items').update({ photo_urls: urls }).eq('id', itemId)
  if (error) throw error
  return urls
}

// ── AUDIT SCHEDULES ─────────────────────────────────────

export async function fetchAuditSchedules() {
  const { data, error } = await supabase
    .from('audit_schedules')
    .select('*, profiles:created_by(full_name)')
    .order('next_due')
  if (error) throw error
  return data || []
}

export async function createAuditSchedule(schedule) {
  const { data, error } = await supabase.from('audit_schedules').insert(schedule).select().single()
  if (error) throw error
  await logActivity(schedule.created_by, 'created', 'audit_schedule', data.id, schedule.title, { frequency: schedule.frequency })
  return data
}

export async function updateAuditSchedule(id, updates) {
  const { error } = await supabase.from('audit_schedules').update(updates).eq('id', id)
  if (error) throw error
  await logActivity(null, 'updated', 'audit_schedule', id, updates.title || id)
}

export async function deleteAuditSchedule(id) {
  const { data: s } = await supabase.from('audit_schedules').select('title').eq('id', id).single()
  const { error } = await supabase.from('audit_schedules').delete().eq('id', id)
  if (error) throw error
  await logActivity(null, 'deleted', 'audit_schedule', id, s?.title || id)
}

// ── AUDIT TEMPLATES & RESULTS ───────────────────────────────

export async function fetchAuditTemplates(cc) {
  let q = supabase.from('audit_templates').select('*').order('name')
  if (cc) q = q.eq('company_code', cc)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function fetchTemplateItems(templateId) {
  const { data, error } = await supabase
    .from('audit_template_items')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order')
  if (error) throw error
  return data || []
}

export async function fetchAuditItemResults(auditItemId) {
  const { data, error } = await supabase
    .from('audit_item_results')
    .select('*, audit_template_items(task_description)')
    .eq('audit_item_id', auditItemId)
  if (error) throw error
  return data || []
}

export async function saveAuditItemResults(auditItemId, resultsArray) {
  if (!resultsArray.length) return
  const { error } = await supabase.from('audit_item_results').upsert(
    resultsArray.map(r => ({
      audit_item_id: auditItemId,
      template_item_id: r.template_item_id,
      status: r.status,
      notes: r.notes,
      checked_at: new Date().toISOString()
    })),
    { onConflict: 'audit_item_id,template_item_id' }
  )
  if (error) throw error
}

// ── MAINTENANCE APPROVALS ───────────────────────────────

export async function approveMaintenanceLog(logId, status, userId, notes) {
  const updates = { approval_status: status, approved_by: userId }
  if (notes) updates.approval_notes = notes
  const { error } = await supabase.from('maintenance_logs').update(updates).eq('id', logId)
  if (error) throw error
}



// ── ASSET CODE GENERATOR ─────────────────────────────────
const CATEGORY_CODE = {
  'Plant & Machinery':  'P&M',
  'Tools & Equipment':  'T&E',
  'Vehicles':           'VEH',
  'Electronics':        'ELEC',
  'Safety Equipment':   'SAF',
  'Scaffolding':        'SCAF',
  'IT':                 'IT',
  'Other':              'OTH',
}

function abbreviate(name) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').toUpperCase()
}

export function getAssetCodePrefix(assetName, category, companyCode = 'SBC') {
  // The user requested a simple 'SBC' prefix rather than Category/Name initials.
  const co = abbreviate(companyCode || 'SBC')
  return `${co}`
}

export async function generateAssetCode(assetName, category, companyCode = 'SBC') {
  const prefix = getAssetCodePrefix(assetName, category, companyCode)
  // Generate a random 6-digit number as requested by the user
  const randomNum = Math.floor(100000 + Math.random() * 900000)
  return `${prefix}${randomNum}`
}

export async function bulkInsertAssets(assets) {
  const { data, error } = await supabase.from('assets').upsert(assets, { onConflict: 'asset_code' }).select()
  if (error) throw error
  await logActivity(assets[0]?.added_by || null, 'imported', 'asset', null, `${assets.length} assets`, { count: assets.length })
  return data
}

export async function fetchStats(cc) {
  let q = supabase.from('assets').select('status, category, site').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
  if (cc) q = q.eq('company_code', cc)
  const { data, error } = await q
  if (error) throw error
  const total = data.length
  const byStatus = {}, byCategory = {}, bySite = {}
  data.forEach(a => {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1
    if (a.category) byCategory[a.category] = (byCategory[a.category] || 0) + 1
    if (a.site)     bySite[a.site]         = (bySite[a.site]         || 0) + 1
  })
  return { total, byStatus, byCategory, bySite }
}

export async function fetchFilterOptions() {
  const [assetsRes, sitesRes] = await Promise.all([
    supabase.from('assets').select('category, site'),
    supabase.from('sites').select('id, name, site_code').order('name'),
  ])
  if (assetsRes.error) throw assetsRes.error
  
  const dbSites = sitesRes.data || []
  const formattedDbSites = dbSites.map(s => s.site_code ? `[${s.site_code}] ${s.name}` : s.name)
  
  const rawSites = [
    ...(assetsRes.data || []).map(a => a.site)
  ].filter(Boolean)

  const uniqueSites = new Set(formattedDbSites)

  rawSites.forEach(rawSite => {
    let matched = false
    for (const dbSite of dbSites) {
      if (isSiteMatch(rawSite, dbSite.name) || (dbSite.site_code && isSiteMatch(rawSite, dbSite.site_code))) {
        matched = true
        break
      }
    }
    if (!matched) {
      uniqueSites.add(rawSite)
    }
  })

  return {
    categories: [...new Set((assetsRes.data || []).map(a => a.category).filter(Boolean))].sort(),
    sites: [...uniqueSites].sort(),
  }
}

// ── AUDIT LOG ────────────────────────────────────────────
async function logAudit(assetId, userId, action, changes) {
  await supabase.from('asset_audit').insert([{ asset_id: assetId, user_id: userId, action, changes }])
}

export async function fetchAudit(assetId) {
  const { data } = await supabase.from('asset_audit').select('*, profiles(full_name, email)').eq('asset_id', assetId).order('created_at', { ascending: false }).limit(20)
  return data || []
}

// ── MAINTENANCE ──────────────────────────────────────────

const SLA_HOURS = { critical: 4, high: 24, normal: 72, low: 168 }

export async function createMaintenanceTicket(data) {
  const ticketNo = `TKT-${Date.now().toString().slice(-6)}`
  const now = new Date()
  const slaHours = SLA_HOURS[data.priority] || 72
  const sla_due_at = new Date(now.getTime() + slaHours * 3600000).toISOString()
  const { data: ticket, error } = await supabase.from('maintenance_tickets').insert([{
    ...data, ticket_no: ticketNo, downtime_start: now.toISOString(), sla_due_at,
  }]).select().single()
  if (error) throw error
  await logActivity(data.reported_by, 'created', 'ticket', ticket.id, `${ticketNo} — ${data.title}`, { priority: data.priority, ticket_type: data.ticket_type })
  return ticket
}

export async function updateMaintenanceTicket(id, updates) {
  const { data, error } = await supabase.from('maintenance_tickets').update(updates).eq('id', id).select().single()
  if (error) throw error
  if (updates.status) await logActivity(updates.assigned_to || data.reported_by, updates.status === 'resolved' ? 'resolved' : 'updated', 'ticket', id, data.ticket_no, { status: updates.status })
  if (updates.assigned_to) await logActivity(null, 'assigned', 'ticket', id, data.ticket_no, { assigned_to: updates.assigned_to })
  return data
}

export async function createMaintenanceSchedule(data) {
  const { data: sched, error } = await supabase.from('maintenance_schedules').insert([data]).select().single()
  if (error) throw error
  await logActivity(data.created_by, 'created', 'schedule', sched.id, data.title, { frequency: data.frequency })
  return sched
}

export async function logMaintenanceWork(logData, inventoryUsage = []) {
  // 1. Insert maintenance log (include ticket_id and vendor_id)
  const { data: log, error } = await supabase.from('maintenance_logs').insert([logData]).select().single()
  if (error) throw error

  // 2. Handle inventory usage if any — insert transaction AND decrement stock
  for (const part of inventoryUsage) {
    const { error: invErr } = await supabase.from('inventory_transactions').insert([{
      item_id: part.item_id,
      transaction_type: 'issue',
      quantity: part.quantity,
      reference: `MAINT-${log.id.slice(0,8)}`,
      notes: part.notes || `Used in maintenance: ${logData.work_done}`,
      performed_by: logData.performed_by
    }])
    if (invErr) { console.error("Inventory transaction error:", invErr); continue }
    // Decrement current_stock
    const { data: item } = await supabase.from('inventory_items').select('current_stock').eq('id', part.item_id).single()
    if (item) {
      await supabase.from('inventory_items').update({ current_stock: Math.max(0, (item.current_stock || 0) - part.quantity) }).eq('id', part.item_id)
    }
  }

  // 3. Update related ticket if applicable (set resolved + downtime_end)
  if (logData.ticket_id) {
    await updateMaintenanceTicket(logData.ticket_id, {
      status: 'resolved', resolved_at: new Date().toISOString(), downtime_end: new Date().toISOString()
    })
  }

  // 4. Update schedule last_done and next_due if applicable
  if (logData.schedule_id) {
    const { data: sched } = await supabase.from('maintenance_schedules').select('*').eq('id', logData.schedule_id).single()
    if (sched) {
      // Calculate next due date
      const lastDone = new Date()
      let nextDue = new Date()
      const freq = sched.frequency
      if (freq === 'daily') nextDue.setDate(lastDone.getDate() + 1)
      else if (freq === 'weekly') nextDue.setDate(lastDone.getDate() + 7)
      else if (freq === 'monthly') nextDue.setMonth(lastDone.getMonth() + 1)
      else if (freq === 'quarterly') nextDue.setMonth(lastDone.getMonth() + 3)
      else if (freq === 'yearly') nextDue.setFullYear(lastDone.getFullYear() + 1)
      
      await supabase.from('maintenance_schedules').update({
        last_done: lastDone.toISOString().split('T')[0],
        next_due: nextDue.toISOString().split('T')[0]
      }).eq('id', sched.id)
    }
  }

  await logActivity(logData.performed_by, 'logged_work', 'maintenance', log.id, logData.work_done, { cost: logData.cost, ticket_id: logData.ticket_id, schedule_id: logData.schedule_id })
  return log
}

export async function fetchMaintenanceLogsPaginated(filters = {}, page = 0, pageSize = 50) {
  const from = page * pageSize
  const to = from + pageSize - 1
  let q = supabase.from('maintenance_logs')
    .select('*, assets(asset_name, asset_code), profiles!performed_by(full_name)', { count: 'exact' })
    .order('performed_at', { ascending: false })
    .range(from, to)
  if (filters.asset_id) q = q.eq('asset_id', filters.asset_id)
  if (filters.search) q = q.or(`work_done.ilike.%${filters.search}%`)
  const { data, error, count } = await q
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

export async function deleteMaintenanceTicket(id) {
  const { data: t } = await supabase.from('maintenance_tickets').select('ticket_no, title').eq('id', id).single()
  const { error } = await supabase.from('maintenance_tickets').update({ status: 'cancelled' }).eq('id', id)
  if (error) throw error
  await logActivity(null, 'cancelled', 'ticket', id, t?.ticket_no || id)
}

export async function updateMaintenanceSchedule(id, updates) {
  const { data, error } = await supabase.from('maintenance_schedules').update(updates).eq('id', id).select().single()
  if (error) throw error
  await logActivity(null, 'updated', 'schedule', id, updates.title || id)
  return data
}

export async function deleteMaintenanceSchedule(id) {
  const { data: s } = await supabase.from('maintenance_schedules').select('title').eq('id', id).single()
  const { error } = await supabase.from('maintenance_schedules').update({ status: 'paused' }).eq('id', id)
  if (error) throw error
  await logActivity(null, 'paused', 'schedule', id, s?.title || id)
}

// ── Ticket Comments ─────────────────────────────────────
export async function fetchTicketComments(ticketId) {
  const { data, error } = await supabase
    .from('ticket_comments')
    .select('*, profiles:user_id(full_name, photo_url)')
    .eq('ticket_id', ticketId)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function addTicketComment(ticketId, userId, comment) {
  const { data, error } = await supabase.from('ticket_comments')
    .insert({ ticket_id: ticketId, user_id: userId, comment })
    .select('*, profiles:user_id(full_name, photo_url)').single()
  if (error) throw error
  return data
}

// ── Maintenance Photos ──────────────────────────────────
export async function uploadMaintenancePhoto(ticketId, logId, file, photoType, userId) {
  const ref = ticketId || logId
  const path = `maintenance-evidence/${ref}/${Date.now()}.jpg`
  const { error: upErr } = await supabase.storage
    .from('checklist-uploads')
    .upload(path, file, { contentType: file.type || 'image/jpeg' })
  if (upErr) throw upErr
  const { data: { publicUrl } } = supabase.storage.from('checklist-uploads').getPublicUrl(path)
  const { data, error } = await supabase.from('maintenance_photos').insert({
    ticket_id: ticketId, log_id: logId, photo_url: publicUrl, photo_type: photoType, uploaded_by: userId
  }).select().single()
  if (error) throw error
  return data
}

export async function fetchMaintenancePhotos(ticketId) {
  const { data, error } = await supabase.from('maintenance_photos')
    .select('*').eq('ticket_id', ticketId).order('created_at')
  if (error) throw error
  return data || []
}

export async function removeMaintenancePhoto(photoId) {
  const { error } = await supabase.from('maintenance_photos').delete().eq('id', photoId)
  if (error) throw error
}

// ── Notifications ───────────────────────────────────────
export async function createNotification(userId, title, body, link) {
  await supabase.from('notifications').insert({ user_id: userId, title, body, link, is_read: false })
}

export async function fetchMyNotifications(userId, limit = 30) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function markNotificationsRead(userId, ids = null) {
  let q = supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
  if (ids?.length) q = q.in('id', ids)
  else q = q.eq('is_read', false)
  const { error } = await q
  if (error) throw error
}

// ── Site Assignments ─────────────────────────────────────
export async function fetchAllSiteAssignments() {
  const { data, error } = await supabase
    .from('user_site_assignments')
    .select('*, profiles:user_id(id, full_name, email, role)')
    .order('site_name')
  if (error) throw error
  return data || []
}

export async function fetchUserSiteAssignments(userId) {
  const { data, error } = await supabase
    .from('user_site_assignments')
    .select('id, site_name, assigned_at')
    .eq('user_id', userId)
    .order('site_name')
  if (error) throw error
  return data || []
}

export async function assignUserToSite(userId, siteName, assignedBy) {
  const { data, error } = await supabase
    .from('user_site_assignments')
    .insert({ user_id: userId, site_name: siteName, assigned_by: assignedBy })
    .select()
    .single()
  if (error) throw error
  await logActivity(assignedBy, 'assigned_site', 'profile', userId, siteName)
  return data
}

export async function removeUserFromSite(assignmentId, removedBy) {
  const { data: row } = await supabase
    .from('user_site_assignments')
    .select('user_id, site_name')
    .eq('id', assignmentId)
    .single()
  const { error } = await supabase
    .from('user_site_assignments')
    .delete()
    .eq('id', assignmentId)
  if (error) throw error
  if (row) await logActivity(removedBy, 'removed_site', 'profile', row.user_id, row.site_name)
}

export async function notifyUsersAtSite(siteName, title, body, link, notificationType = 'general') {
  try {
    const { data: assignments } = await supabase
      .from('user_site_assignments')
      .select('user_id')
      .eq('site_name', siteName)
    if (!assignments?.length) return
    const rows = assignments.map(a => ({
      user_id: a.user_id,
      title,
      body,
      link,
      is_read: false,
      notification_type: notificationType,
    }))
    await supabase.from('notifications').insert(rows)
  } catch (err) {
    console.error('Site notification error:', err)
  }
}

// ── Vendor CRUD ─────────────────────────────────────────
export async function fetchAllVendors() {
  const { data, error } = await supabase.from('vendors').select('*').order('name')
  if (error) throw error
  return data || []
}

export async function createVendor(vendor) {
  const { data, error } = await supabase.from('vendors').insert([vendor]).select().single()
  if (error) throw error
  await logActivity(null, 'created', 'vendor', data.id, vendor.name)
  return data
}

export async function updateVendor(id, updates) {
  const { data, error } = await supabase.from('vendors').update(updates).eq('id', id).select().single()
  if (error) throw error
  await logActivity(null, 'updated', 'vendor', id, data.name, { fields: Object.keys(updates) })
  return data
}

export async function deleteVendor(id) {
  const { data: v } = await supabase.from('vendors').select('name').eq('id', id).single()
  const { error } = await supabase.from('vendors').delete().eq('id', id)
  if (error) throw error
  await logActivity(null, 'deleted', 'vendor', id, v?.name || id)
}

// ── Auto-create tickets from overdue schedules ──────────
export async function autoCreateOverdueTickets(userId) {
  const today = new Date().toISOString().split('T')[0]
  const { data: overdue } = await supabase
    .from('maintenance_schedules')
    .select('id, asset_id, title')
    .eq('status', 'active')
    .lt('next_due', today)
  if (!overdue?.length) return 0

  let created = 0
  for (const sched of overdue) {
    // Check if ticket already exists for this schedule (any unresolved status)
    const { data: existing } = await supabase.from('maintenance_tickets')
      .select('id').eq('source_schedule_id', sched.id).in('status', ['open', 'assigned', 'working']).limit(1)
    if (existing?.length) continue
    const ticketNo = `TKT-${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(-2)}`
    await supabase.from('maintenance_tickets').insert({
      ticket_no: ticketNo, asset_id: sched.asset_id, title: `[Scheduled] ${sched.title}`,
      ticket_type: 'scheduled', priority: 'normal', reported_by: userId,
      source_schedule_id: sched.id, downtime_start: new Date().toISOString(),
      sla_due_at: new Date(Date.now() + 72 * 3600000).toISOString(),
    })
    created++
  }
  return created
}

// ── GATE PASSES ─────────────────────────────────────────
export async function fetchGatePasses(companyCode) {
  let q = supabase.from('gate_passes')
    .select('*, requester:profiles!requested_by(full_name), approver:profiles!approved_by(full_name)')
    .order('created_at', { ascending: false })
  if (companyCode) q = q.eq('company_code', companyCode)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function fetchGatePassItems(gatePassId) {
  const { data, error } = await supabase.from('gate_pass_items')
    .select('*, inventory_items(item_name, item_code), assets(asset_name, asset_code)')
    .eq('gate_pass_id', gatePassId)
  if (error) throw error
  return data || []
}

export async function createGatePass(passData, items, userId, companyCode) {
  const passNo = `GP-${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(-2).toUpperCase()}`
  const { data: pass, error } = await supabase.from('gate_passes').insert({
    ...passData, pass_no: passNo, requested_by: userId, company_code: companyCode || 'SWG',
  }).select().single()
  if (error) throw error
  if (items?.length) {
    const rows = items.map(it => ({ ...it, gate_pass_id: pass.id }))
    await supabase.from('gate_pass_items').insert(rows)
  }
  await logActivity(userId, 'created', 'gate_pass', pass.id, passNo, { pass_type: passData.pass_type }, companyCode)
  return pass
}

export async function updateGatePass(id, updates, userId, companyCode) {
  const { data, error } = await supabase.from('gate_passes').update(updates).eq('id', id).select().single()
  if (error) throw error
  const action = updates.status === 'approved' ? 'approved' : updates.status === 'rejected' ? 'rejected' : updates.status === 'completed' ? 'completed' : 'updated'
  await logActivity(userId, action, 'gate_pass', id, data.pass_no, { status: updates.status }, companyCode)
  return data
}

export async function deleteGatePass(id) {
  const { data: pass } = await supabase.from('gate_passes').select('pass_no').eq('id', id).single()
  const { error } = await supabase.from('gate_passes').update({ status: 'cancelled' }).eq('id', id)
  if (error) throw error
  await logActivity(null, 'cancelled', 'gate_pass', id, pass?.pass_no || id)
}


// ══════════════════════════════════════════════════════════
// AUDIT & MAINTENANCE MODULE
// ══════════════════════════════════════════════════════════

// ── SITES ────────────────────────────────────────────────
export async function fetchSites() {
  const { data, error } = await supabase
    .from('sites')
    .select('*, checker:profiles!checker_id(id, full_name, email), hod:profiles!hod_id(id, full_name, email)')
    .order('name')
  if (error) throw error
  return data || []
}

export async function createSite(site, userId) {
  const { data, error } = await supabase.from('sites').insert(site).select().single()
  if (error) throw error
  await logActivity(userId, 'created', 'site', data.id, site.name)
  return data
}

export async function updateSite(id, updates, userId) {
  const { data, error } = await supabase.from('sites').update(updates).eq('id', id).select().single()
  if (error) throw error
  await logActivity(userId, 'updated', 'site', id, data.name, { fields: Object.keys(updates) })
  return data
}

export async function deleteSite(id) {
  const { error } = await supabase.from('sites').delete().eq('id', id)
  if (error) throw error
}

// ── AUDIT ASSIGNMENTS ────────────────────────────────────
export async function fetchAuditAssignments(filters = {}) {
  let q = supabase
    .from('audit_assignments')
    .select('*, site:sites(*), auditor:profiles!assigned_to(id, full_name, email, photo_url), assigner:profiles!assigned_by(id, full_name)')
    .order('created_at', { ascending: false })
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.audit_type) q = q.eq('audit_type', filters.audit_type)
  if (filters.assigned_to) q = q.eq('assigned_to', filters.assigned_to)
  if (filters.site_id) q = q.eq('site_id', filters.site_id)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function fetchAuditAssignment(id) {
  const { data, error } = await supabase
    .from('audit_assignments')
    .select('*, site:sites(*), auditor:profiles!assigned_to(id, full_name, email, photo_url), assigner:profiles!assigned_by(id, full_name)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createAuditAssignment(assignment, userId) {
  const payload = {
    ...assignment,
    assigned_by: userId
  }
  delete payload.blind_count
  delete payload.is_blind_audit

  const { data, error } = await supabase
    .from('audit_assignments')
    .insert(payload)
    .select().single()

  if (error) throw error
  await logActivity(userId, 'created', 'audit_assignment', data.id, assignment.title, { audit_type: assignment.audit_type })
  // Notify the assigned auditor
  if (assignment.assigned_to) {
    await createNotification(
      assignment.assigned_to,
      'New Audit Assigned',
      `You have been assigned a new ${assignment.audit_type === 'asset_count' ? 'Asset Count' : 'Maintenance Checklist'} audit: "${assignment.title}"`,
      '/audit'
    )
  }
  return data
}

export async function updateAuditAssignment(id, updates, userId) {
  const { data, error } = await supabase
    .from('audit_assignments')
    .update(updates)
    .eq('id', id)
    .select().single()
  if (error) throw error
  await logActivity(userId, 'updated', 'audit_assignment', id, data.title, { fields: Object.keys(updates) })
  return data
}

export async function deleteAuditAssignment(id) {
  await supabase.from('audit_assignment_items').delete().eq('assignment_id', id)
  const { error } = await supabase.from('audit_assignments').delete().eq('id', id)
  if (error) throw error
}

// ── AUDIT ASSIGNMENT ITEMS ───────────────────────────────
export async function fetchAssignmentItems(assignmentId) {
  const { data, error } = await supabase
    .from('audit_assignment_items')
    .select('*, asset:assets(id, asset_code, asset_name, category, site, location, latitude, longitude, status, make, model_no, serial_no)')
    .eq('assignment_id', assignmentId)
    .order('id', { ascending: true })
  if (error) throw error
  return data || []
}

export async function populateAssignmentItems(assignmentId, siteId) {
  // Get site name from sites table
  const { data: site, error: sErr } = await supabase.from('sites').select('name').eq('id', siteId).maybeSingle()
  const siteName = site?.name
  if (!siteName) throw new Error('Site not found. Please make sure the site exists in the Sites tab.')

  // Fetch all assets
  const { data: allAssets, error: aErr } = await supabase
    .from('assets')
    .select('id, site')
  if (aErr) throw aErr

  // Smart fuzzy site matching (handles P150_STELLA, STELLA, P150 - STELLA)
  const matchedAssets = (allAssets || []).filter(a => isSiteMatch(a.site, siteName))
  if (!matchedAssets?.length) throw new Error(`No assets found for site "${siteName}"`)

  // Insert items (skip duplicates)
  const rows = matchedAssets.map(a => ({ assignment_id: assignmentId, asset_id: a.id }))
  const { error } = await supabase.from('audit_assignment_items').upsert(rows, { onConflict: 'assignment_id,asset_id', ignoreDuplicates: true })
  if (error) throw error
  return rows.length
}

export async function updateAssignmentItem(id, updates) {
  const { data, error } = await supabase
    .from('audit_assignment_items')
    .update(updates)
    .eq('id', id)
    .select().single()
  if (error) throw error
  return data
}

export async function scanAssignmentItem(itemId, condition, conditionNotes, latitude, longitude, siteLatitude, siteLongitude, siteRadius, userId) {
  // Calculate distance between scan location and site
  const geoVerified = isWithinRadius(latitude, longitude, siteLatitude, siteLongitude, siteRadius || 200)

  const { data, error } = await supabase
    .from('audit_assignment_items')
    .update({
      status: geoVerified ? 'verified' : 'unverified',
      condition,
      condition_notes: conditionNotes,
      scanned_at: new Date().toISOString(),
      scan_latitude: latitude,
      scan_longitude: longitude,
      geo_verified: geoVerified,
      scanned_by: userId,
    })
    .eq('id', itemId)
    .select().single()
  if (error) throw error

  // Sync physical audit condition to main assets table
  if (data?.asset_id) {
    try {
      let assetCondition = 'Good'
      let assetStatusUpdates = {}

      if (condition === 'operational') {
        assetCondition = 'Good'
      } else if (condition === 'damaged') {
        assetCondition = 'Damaged'
      } else if (condition === 'needs_repair' || condition === 'non_functional') {
        assetCondition = 'Under Repair'
        assetStatusUpdates.status = 'Under Repair'
      } else if (condition === 'missing') {
        assetCondition = 'Missing'
        assetStatusUpdates.status = 'Inactive'
      }

      if (condition === 'needs_repair' || condition === 'non_functional') {
        await syncAssetStatusWithMaintenance(data.asset_id, 'Under Repair', `[AUDIT-BREAKDOWN] Physical audit condition logged as ${condition}: ${conditionNotes || 'Requires maintenance'}`)
      } else {
        await supabase
          .from('assets')
          .update({ condition: assetCondition, ...assetStatusUpdates })
          .eq('id', data.asset_id)
      }
    } catch (e) {
      console.warn('Failed to sync condition to main asset record:', e)
    }
  }

  return data
}

// Haversine formula for geo-verification
function isWithinRadius(lat1, lon1, lat2, lon2, radiusMeters) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return false
  const R = 6371000 // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c
  return distance <= radiusMeters
}

export { isWithinRadius }

// ── MAINTENANCE CHECKLISTS ───────────────────────────────
export async function fetchMaintenanceChecklists() {
  const { data, error } = await supabase
    .from('maintenance_checklists')
    .select('*, creator:profiles!created_by(full_name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createMaintenanceChecklist(checklist, userId) {
  const { data, error } = await supabase
    .from('maintenance_checklists')
    .insert({ ...checklist, created_by: userId })
    .select().single()
  if (error) throw error
  await logActivity(userId, 'created', 'maintenance_checklist', data.id, checklist.name)
  return data
}

export async function updateMaintenanceChecklist(id, updates, userId) {
  const { data, error } = await supabase
    .from('maintenance_checklists')
    .update(updates)
    .eq('id', id)
    .select().single()
  if (error) throw error
  return data
}

export async function deleteMaintenanceChecklist(id) {
  const { error } = await supabase.from('maintenance_checklists').delete().eq('id', id)
  if (error) throw error
}

// Link checklists to assets
export async function linkChecklistToAssets(checklistId, assetIds) {
  const rows = assetIds.map(aid => ({ checklist_id: checklistId, asset_id: aid }))
  const { error } = await supabase
    .from('maintenance_checklist_assets')
    .upsert(rows, { onConflict: 'checklist_id,asset_id', ignoreDuplicates: true })
  if (error) throw error
}

export async function fetchChecklistAssetLinks(checklistId) {
  const { data, error } = await supabase
    .from('maintenance_checklist_assets')
    .select('*, asset:assets(id, asset_code, asset_name, category, site)')
    .eq('checklist_id', checklistId)
  if (error) throw error
  return data || []
}

export async function getChecklistsForAsset(assetId) {
  const { data, error } = await supabase
    .from('maintenance_checklist_assets')
    .select('*, checklist:maintenance_checklists(*)')
    .eq('asset_id', assetId)
  if (error) throw error
  return (data || []).map(d => d.checklist).filter(Boolean)
}

// ── MAINTENANCE AUDIT SUBMISSIONS ────────────────────────
export async function fetchMaintenanceSubmissions(filters = {}) {
  let q = supabase
    .from('maintenance_audit_submissions')
    .select(`
      *,
      checklist:maintenance_checklists(id, name, category, frequency),
      asset:assets(id, asset_code, asset_name, category, site),
      preparer:profiles!prepared_by(id, full_name, email),
      checker_profile:profiles!checker_id(id, full_name, email),
      hod_profile:profiles!hod_id(id, full_name, email),
      assignment:audit_assignments(id, title, site:sites(*))
    `)
    .order('submitted_at', { ascending: false })
  if (filters.approval_status) q = q.eq('approval_status', filters.approval_status)
  if (filters.checker_id) q = q.eq('checker_id', filters.checker_id)
  if (filters.hod_id) q = q.eq('hod_id', filters.hod_id)
  if (filters.submitted_by) q = q.eq('submitted_by', filters.submitted_by)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createMaintenanceSubmission(submission, userId) {
  const { data, error } = await supabase
    .from('maintenance_audit_submissions')
    .insert({
      ...submission,
      submitted_by: userId,
      prepared_by: userId,
      prepared_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    })
    .select().single()
  if (error) throw error

  // Notify the checker
  if (submission.checker_id) {
    await createNotification(
      submission.checker_id,
      'Maintenance Audit Pending Review',
      `A maintenance audit submission is awaiting your review and approval.`,
      '/audit'
    )
  }

  await logActivity(userId, 'submitted', 'maintenance_audit', data.id, `Maintenance Audit`, { checklist_id: submission.checklist_id })
  return data
}

export async function approveAsChecker(submissionId, checkerId, signature, checkerName, notes) {
  const { data, error } = await supabase
    .from('maintenance_audit_submissions')
    .update({
      approval_status: 'pending_hod',
      checker_id: checkerId,
      checker_signature: signature,
      checker_name: checkerName,
      checker_notes: notes,
      checked_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select().single()
  if (error) throw error

  // Notify the HOD
  if (data.hod_id) {
    await createNotification(
      data.hod_id,
      'Maintenance Audit Pending Final Approval',
      `A maintenance audit has been checked and is awaiting your final approval.`,
      '/audit'
    )
  }

  await logActivity(checkerId, 'checked', 'maintenance_audit', submissionId, 'Maintenance Audit')
  return data
}

export async function approveAsHOD(submissionId, hodId, signature, hodName, notes) {
  const { data, error } = await supabase
    .from('maintenance_audit_submissions')
    .update({
      approval_status: 'approved',
      hod_id: hodId,
      hod_signature: signature,
      hod_name: hodName,
      hod_notes: notes,
      approved_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select().single()
  if (error) throw error

  // Notify the auditor that it's fully approved
  if (data.prepared_by) {
    await createNotification(
      data.prepared_by,
      'Maintenance Audit Approved',
      `Your maintenance audit has been fully approved by the HOD.`,
      '/audit'
    )
  }

  await logActivity(hodId, 'approved', 'maintenance_audit', submissionId, 'Maintenance Audit')
  return data
}

export async function rejectSubmission(submissionId, userId, notes, role) {
  const updates = {
    approval_status: 'rejected',
    ...(role === 'checker'
      ? { checker_notes: notes, checked_at: new Date().toISOString() }
      : { hod_notes: notes, approved_at: new Date().toISOString() }
    ),
  }
  const { data, error } = await supabase
    .from('maintenance_audit_submissions')
    .update(updates)
    .eq('id', submissionId)
    .select().single()
  if (error) throw error

  // Notify auditor of rejection
  if (data.prepared_by) {
    await createNotification(
      data.prepared_by,
      'Maintenance Audit Rejected',
      `Your maintenance audit has been rejected. Please review the notes and resubmit.`,
      '/audit'
    )
  }

  await logActivity(userId, 'rejected', 'maintenance_audit', submissionId, 'Maintenance Audit')
  return data
}

// ── BULK MAINTENANCE TICKETS ────────────────────────────
export async function bulkCreateMaintenanceTickets(assetIds, data) {
  const now = new Date()
  const slaHours = SLA_HOURS[data.priority] || 72
  const sla_due_at = new Date(now.getTime() + slaHours * 3600000).toISOString()
  
  const payload = assetIds.map((assetId, i) => ({
    asset_id: assetId,
    title: data.title,
    description: data.description,
    ticket_type: data.ticket_type,
    priority: data.priority,
    reported_by: data.reported_by,
    assigned_to: data.assigned_to,
    ticket_no: `TKT-${Date.now().toString().slice(-6)}${i}`,
    downtime_start: now.toISOString(),
    sla_due_at,
    status: 'open'
  }))
  
  const { data: tickets, error } = await supabase.from('maintenance_tickets').insert(payload).select()
  if (error) throw error
  await logActivity(data.reported_by, 'bulk_created', 'ticket', null, `${assetIds.length} Maintenance Tickets`, { priority: data.priority, count: assetIds.length })
  return tickets
}

// ── ASSET TIMELINE (HISTORY DRAWER) ─────────────────────
export async function fetchAssetFullTimeline(assetId) {
  const [auditRes, ticketsRes, logsRes, movesRes] = await Promise.all([
    supabase.from('asset_audit').select('id, action, changes, created_at, profiles(full_name)').eq('asset_id', assetId).order('created_at', { ascending: false }).limit(20),
    supabase.from('maintenance_tickets').select('id, ticket_no, title, status, created_at').eq('asset_id', assetId).order('created_at', { ascending: false }).limit(10),
    supabase.from('maintenance_logs').select('id, work_done, created_at, profiles:performed_by(full_name)').eq('asset_id', assetId).order('created_at', { ascending: false }).limit(10),
    supabase.from('asset_movements').select('id, movement_type, from_location, to_location, notes, created_at, profiles:moved_by(full_name)').eq('asset_id', assetId).order('created_at', { ascending: false }).limit(10)
  ])

  const events = []
  
  if (auditRes.data) {
    auditRes.data.forEach(item => {
      events.push({
        type: 'audit',
        date: new Date(item.created_at),
        title: item.action === 'created' ? 'Asset Created' : item.action === 'updated' ? 'Asset Updated' : item.action === 'transferred' ? 'Asset Transferred' : 'Asset Audited',
        user: item.profiles?.full_name || 'System',
        details: item.changes,
        icon: item.action === 'created' ? 'plus' : item.action === 'updated' ? 'edit' : 'activity',
        raw: item
      })
    })
  }

  if (ticketsRes.data) {
    ticketsRes.data.forEach(item => {
      events.push({
        type: 'ticket',
        date: new Date(item.created_at),
        title: `Ticket Opened: ${item.ticket_no}`,
        user: 'Maintenance',
        details: { title: item.title, status: item.status },
        icon: 'ticket',
        raw: item
      })
    })
  }

  if (logsRes.data) {
    logsRes.data.forEach(item => {
      events.push({
        type: 'maintenance',
        date: new Date(item.created_at),
        title: 'Maintenance Performed',
        user: item.profiles?.full_name || 'Technician',
        details: { work_done: item.work_done },
        icon: 'tool',
        raw: item
      })
    })
  }

  if (movesRes.data) {
    movesRes.data.forEach(item => {
      events.push({
        type: 'movement',
        date: new Date(item.created_at),
        title: item.movement_type === 'transfer' ? 'Asset Transferred' : 'Asset Moved',
        user: item.profiles?.full_name || 'System',
        details: { from: item.from_location, to: item.to_location, notes: item.notes },
        icon: 'map-pin',
        raw: item
      })
    })
  }

  // Sort all events chronologically (newest first)
  return events.sort((a, b) => b.date - a.date)
}

// ── EMPLOYEES ───────────────────────────────────────────
export async function fetchEmployees() {
  const { data, error } = await supabase.from('employees').select('*').order('full_name')
  if (error) throw error
  return data || []
}

export async function createEmployee(employee) {
  const { data, error } = await supabase.from('employees').insert([employee]).select().single()
  if (error) throw error
  return data
}

export async function bulkCreateEmployees(employees, overwrite = false) {
  if (overwrite) {
    const { data, error } = await supabase.from('employees').upsert(employees, { onConflict: 'employee_code' }).select()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase.from('employees').insert(employees).select()
    if (error) throw error
    return data
  }
}

export async function updateEmployee(id, updates) {
  const { data, error } = await supabase.from('employees').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteEmployee(id) {
  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) throw error
}

// ── TOOL CRIB ───────────────────────────────────────────

export async function fetchActiveCheckouts() {
  const { data, error } = await supabase.from('tool_transactions')
    .select('*, assets(asset_name, asset_code), employees(full_name, employee_code), profiles!issued_by(full_name)')
    .eq('status', 'checked_out')
    .order('issued_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function checkoutTool(assetId, employeeId, userId) {
  const { data: existing } = await supabase.from('tool_transactions')
    .select('id')
    .eq('asset_id', assetId)
    .eq('status', 'checked_out')
    .maybeSingle()
  
  if (existing) throw new Error('Tool is already checked out.')

  const { data, error } = await supabase.from('tool_transactions').insert({
    asset_id: assetId,
    employee_id: employeeId,
    issued_by: userId,
    status: 'checked_out'
  }).select().single()
  
  if (error) throw error

  await supabase.from('assets').update({ 
    status: 'On Hire', 
    assigned_employee_id: employeeId 
  }).eq('id', assetId)

  await logActivity(userId, 'created', 'tool_checkout', data.id, 'Tool Checked Out')
  return data
}

export async function checkinTool(transactionId, assetId, userId, condition = 'returned') {
  const { data, error } = await supabase.from('tool_transactions').update({
    status: condition,
    returned_at: new Date().toISOString(),
    received_by: userId
  }).eq('id', transactionId).select().single()
  
  if (error) throw error

  await supabase.from('assets').update({ 
    status: condition === 'damaged' ? 'Under Repair' : (condition === 'lost' ? 'Disposed' : 'Active'),
    assigned_employee_id: null 
  }).eq('id', assetId)

  await logActivity(userId, 'updated', 'tool_checkin', data.id, 'Tool Checked In')
  return data
}

export async function fetchToolHistory(assetId) {
  const { data, error } = await supabase.from('tool_transactions')
    .select('*, employees(full_name), profiles!issued_by(full_name), profiles!received_by(full_name)')
    .eq('asset_id', assetId)
    .order('issued_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── DOCUMENT MANAGEMENT ─────────────────────────────────

export async function fetchAssetDocuments(assetId) {
  const { data, error } = await supabase.from('asset_documents')
    .select('*, profiles!uploaded_by(full_name)')
    .eq('asset_id', assetId)
    .order('expiry_date', { ascending: true, nullsLast: true })
  if (error) throw error
  return data || []
}

export async function uploadAssetDocument(assetId, file, meta, userId) {
  validateDocument(file)
  const path = `documents/${assetId}/${Date.now()}-${file.name}`
  const { error: upErr } = await supabase.storage.from('checklist-uploads').upload(path, file, { contentType: file.type })
  if (upErr) throw upErr
  
  const { data: { publicUrl } } = supabase.storage.from('checklist-uploads').getPublicUrl(path)
  
  const { data, error } = await supabase.from('asset_documents').insert({
    asset_id: assetId, 
    file_url: publicUrl, 
    file_name: file.name,
    document_type: meta.document_type,
    document_number: meta.document_number || null,
    issue_date: meta.issue_date || null,
    expiry_date: meta.expiry_date || null,
    uploaded_by: userId
  }).select('*, profiles!uploaded_by(full_name)').single()
  
  if (error) throw error
  await logActivity(userId, 'uploaded', 'document', data.id, file.name, { document_type: meta.document_type })
  return data
}

export async function deleteAssetDocument(documentId) {
  const { error } = await supabase.from('asset_documents').delete().eq('id', documentId)
  if (error) throw error
}

export async function fetchExpiringDocuments(daysAhead = 30) {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + daysAhead)
  
  const { data, error } = await supabase.from('asset_documents')
    .select('*, assets(asset_code, asset_name, site)')
    .lte('expiry_date', futureDate.toISOString().split('T')[0])
    .order('expiry_date', { ascending: true })
    
  if (error) throw error
  return data || []
}

// ── SRS GLOBAL-CLASS HELPERS ──────────────────────────────

// 1. Dual-State Asset Scrap Workflow
export async function requestAssetScrap(asset, { scrapValue = 0, scrapReason = '', isAdmin = false, userId }) {
  if (!asset?.id) throw new Error('Invalid asset reference')
  if (isAdmin) {
    // Admin direct disposal
    const { data, error } = await supabase.from('assets').update({
      status: 'Disposed',
      is_scrapped: true,
      pending_scrap: false,
      scrap_value: Number(scrapValue || 0),
      scrap_reason: scrapReason,
      scrap_date: new Date().toISOString()
    }).eq('id', asset.id).select().single()
    if (error) throw error
    await logActivity(userId, 'scrapped', 'asset', asset.id, asset.asset_name || asset.asset_code, { scrapValue, scrapReason })
    return data
  } else {
    // Field user pending scrap
    const { data, error } = await supabase.from('assets').update({
      pending_scrap: true,
      scrap_reason: scrapReason,
      scrap_value: Number(scrapValue || 0)
    }).eq('id', asset.id).select().single()
    if (error) throw error
    await logActivity(userId, 'requested_scrap', 'asset', asset.id, asset.asset_name || asset.asset_code, { scrapReason })
    return data
  }
}

// 2. Auto Work-Order Trigger & Transfer Lock Sync
export async function syncAssetStatusWithMaintenance(assetId, newStatus, user) {
  if (!assetId) return
  const isRepairStatus = newStatus === 'Under Repair' || newStatus === 'Breakdown' || newStatus === 'In Repair'
  
  if (isRepairStatus) {
    // Lock asset transfer
    await supabase.from('assets').update({ transfer_locked: true, status: newStatus }).eq('id', assetId)
    
    // Check if open ticket exists
    const { data: openTkts } = await supabase.from('maintenance_tickets')
      .select('id')
      .eq('asset_id', assetId)
      .in('status', ['open', 'assigned', 'working'])
      
    if (!openTkts || openTkts.length === 0) {
      // Auto-create breakdown ticket
      const { data: assetObj } = await supabase.from('assets').select('asset_code, asset_name, site').eq('id', assetId).single()
      const title = `[AUTO-WO] Breakdown - ${assetObj?.asset_code || ''} (${assetObj?.asset_name || 'Asset'}) - ${assetObj?.site || 'Site'}`
      await createMaintenanceTicket({
        asset_id: assetId,
        title,
        description: `Automated breakdown ticket generated when asset was marked as ${newStatus}.`,
        priority: 'high',
        ticket_type: 'breakdown',
        status: 'open',
        reported_by: user?.id || null,
        site_name: assetObj?.site || ''
      })
    }
  } else if (newStatus === 'Active') {
    // Unlock asset transfer if active
    await supabase.from('assets').update({ transfer_locked: false, status: 'Active' }).eq('id', assetId)
  }
}

// 3. Stock Audit & Anomaly Detection (>10% Variance Alert)
export async function submitStockAuditReconciliation({ site, itemId, physicalQty, systemQty, reasoning, actionId = crypto.randomUUID() }) {
  const { data, error } = await supabase.rpc('reconcile_bulk_stock', {
    p_action_id: actionId, p_item_id: itemId, p_site: site,
    p_expected: Number(systemQty), p_physical: Number(physicalQty), p_reason: reasoning,
  })
  if (error) throw error
  return data
}

export function saveOfflineAction(actionType, payload, userId) {
  return enqueueOffline(localStorage, userId, actionType, payload)
}

export async function syncOfflineActionsQueue(userId) {
  return drainOffline(localStorage, userId, async item => {
    const { data, error } = await supabase.auth.getUser()
    if (error || data.user?.id !== userId) throw new Error('Your account changed. Sign in again before syncing.')
    await submitStockAuditReconciliation({ ...item.payload, actionId: item.id })
  })
}






// --- Category Management (added Aug 26) ---------------------------------------
export async function fetchCategories() {
  const { data, error } = await supabase.from('asset_categories').select('*').order('name')
  if (error) throw error
  return data || []
}

export async function addCategory(name) {
  const { data, error } = await supabase.from('asset_categories').insert({ name: name.trim() }).select().single()
  if (error) throw error
  return data
}

export async function renameCategory(oldName, newName) {
  const { error } = await supabase.from('asset_categories').update({ name: newName.trim() }).eq('name', oldName)
  if (error) throw error
}

export async function deleteCategory(id) {
  const { error } = await supabase.from('asset_categories').delete().eq('id', id)
  if (error) throw error
}
