/**
 * partsService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for spare parts across BOTH tracks.
 *
 *   SERIALIZED  every unit has its own serial number and its own history.
 *               Hard drives, SSDs, motherboards, batteries, motors.
 *               Table: serialized_components
 *
 *   BULK        quantity only, no per-unit identity.
 *               Thermal paste, screws, cable, oil.
 *               Tables: bulk_items + bulk_site_stock
 *
 * Every state change goes through a Postgres RPC so it is atomic. Nothing in
 * this file performs multi-step writes from the browser, because a failure
 * halfway through would leave the ledger inconsistent.
 *
 * Requires migration 004_parts_lifecycle_integration.sql.
 */

import { supabase } from '../lib/supabase'

// ═════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════

/** Lifecycle states a serialized part can be in. */
export const COMPONENT_STATUS = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  INSTALLED: 'INSTALLED',
  UNDER_REPAIR: 'UNDER_REPAIR',
  RETURNED_TO_VENDOR: 'RETURNED_TO_VENDOR',
  SCRAPPED: 'SCRAPPED',
  DISPOSED: 'DISPOSED',
  LOST: 'LOST',
  WRITTEN_OFF: 'WRITTEN_OFF',
}

/** Human labels + semantic colour token for each status. */
export const STATUS_META = {
  AVAILABLE:          { label: 'Available',          tone: 'success' },
  RESERVED:           { label: 'Reserved',           tone: 'info'    },
  INSTALLED:          { label: 'Installed',          tone: 'info'    },
  UNDER_REPAIR:       { label: 'Under Repair',       tone: 'warning' },
  RETURNED_TO_VENDOR: { label: 'Returned to Vendor', tone: 'warning' },
  SCRAPPED:           { label: 'Scrapped',           tone: 'danger'  },
  DISPOSED:           { label: 'Disposed',           tone: 'danger'  },
  LOST:               { label: 'Lost',               tone: 'danger'  },
  WRITTEN_OFF:        { label: 'Written Off',        tone: 'danger'  },
}

/**
 * What happens to a part when it comes out of an asset.
 * `status` is the state the part lands in; `needsScrapValue` drives the UI.
 */
export const DISPOSITIONS = [
  { value: 'AVAILABLE',          label: 'Return to store (reusable)', status: 'AVAILABLE',          needsScrapValue: false },
  { value: 'REPAIR',             label: 'Send for repair',            status: 'UNDER_REPAIR',       needsScrapValue: false },
  { value: 'VENDOR',             label: 'Return to vendor / warranty',status: 'RETURNED_TO_VENDOR', needsScrapValue: false },
  { value: 'SCRAPPED',           label: 'Scrap / dispose',            status: 'SCRAPPED',           needsScrapValue: true  },
  { value: 'LOST',               label: 'Lost / untraceable',         status: 'LOST',               needsScrapValue: false },
]

export function dispositionToStatus(disposition) {
  return DISPOSITIONS.find(d => d.value === disposition)?.status || 'AVAILABLE'
}

/** Statuses from which a part can never be installed again. */
export const TERMINAL_STATUSES = ['SCRAPPED', 'DISPOSED', 'WRITTEN_OFF', 'LOST']

export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status)
}

// ═════════════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Supabase surfaces Postgres RAISE EXCEPTION text in a few different shapes.
 * The RPCs raise readable, actionable messages, so surface them verbatim rather
 * than a generic failure string.
 */
function unwrapError(error, fallback) {
  if (!error) return new Error(fallback)
  const raw = error.message || error.details || error.hint || fallback
  // Strip the plpgsql context noise Postgres appends
  const clean = String(raw).split('\nCONTEXT:')[0].replace(/^ERROR:\s*/i, '').trim()
  const err = new Error(clean || fallback)
  err.code = error.code
  err.original = error
  return err
}

async function callRpc(fn, args, fallbackMessage) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw unwrapError(error, fallbackMessage)
  return data
}

function requireUser(userId, action) {
  if (!userId) throw new Error(`You must be signed in to ${action}.`)
}

// ═════════════════════════════════════════════════════════════════════════════
// CATEGORIES  (moved out of localStorage into part_categories)
// ═════════════════════════════════════════════════════════════════════════════

export async function fetchPartCategories(track) {
  let q = supabase
    .from('part_categories')
    .select('id, name, track, sort_order')
    .eq('is_active', true)
  if (track) q = q.in('track', [track, 'both'])
  const { data, error } = await q.order('sort_order').order('name')
  if (error) throw unwrapError(error, 'Could not load part categories')
  return data || []
}

export async function createPartCategory(name, track = 'both') {
  const clean = String(name || '').trim()
  if (!clean) throw new Error('Category name is required.')
  const { data, error } = await supabase
    .from('part_categories')
    .insert({ name: clean, track, sort_order: 500 })
    .select()
    .single()
  if (error) {
    if (error.code === '23505' || error.code === '23000' || /duplicate/i.test(error.message || '')) {
      throw new Error(`The category "${clean}" already exists.`)
    }
    throw unwrapError(error, 'Could not create category')
  }
  return data
}

// ═════════════════════════════════════════════════════════════════════════════
// SERIALIZED TRACK  ·  READS
// ═════════════════════════════════════════════════════════════════════════════

const COMPONENT_SELECT = `
  *,
  asset:current_asset_id ( id, asset_code, asset_name, site, location ),
  vendor:vendor_id ( id, name )
`

/**
 * List serialized parts.
 * @param {object} filters
 *   status    one of COMPONENT_STATUS, or 'All'
 *   category  category name, or 'All'
 *   site      site name, or 'All'
 *   search    matches serial / name / part number / asset code
 *   assetId   only parts currently installed in this asset
 *   available shortcut for "installable right now"
 */
export async function fetchSerializedComponents(filters = {}) {
  let q = supabase.from('serialized_components').select(COMPONENT_SELECT)

  if (filters.available) {
    q = q.in('status', ['AVAILABLE', 'RESERVED'])
  } else if (filters.status && filters.status !== 'All') {
    q = q.eq('status', filters.status)
  }
  if (filters.category && filters.category !== 'All') q = q.eq('category', filters.category)
  if (filters.site && filters.site !== 'All') q = q.eq('site', filters.site)
  if (filters.assetId) q = q.eq('current_asset_id', filters.assetId)
  if (filters.search) {
    const s = String(filters.search).trim().replace(/[%,()]/g, '')
    if (s) {
      q = q.or(
        `serial_number.ilike.%${s}%,name.ilike.%${s}%,part_number.ilike.%${s}%,model.ilike.%${s}%,manufacturer.ilike.%${s}%`
      )
    }
  }
  if (filters.limit) q = q.limit(filters.limit)

  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw unwrapError(error, 'Could not load serialized parts')
  return data || []
}

/** Parts that can be installed right now. Used by every install/replace picker. */
export function fetchAvailableComponents(filters = {}) {
  return fetchSerializedComponents({ ...filters, available: true })
}

export async function getComponentById(id) {
  const { data, error } = await supabase
    .from('serialized_components')
    .select(COMPONENT_SELECT)
    .eq('id', id)
    .single()
  if (error) throw unwrapError(error, 'Could not load part')
  return data
}

export async function findComponentBySerial(serial) {
  const clean = String(serial || '').trim()
  if (!clean) return null
  const { data, error } = await supabase
    .from('serialized_components')
    .select(COMPONENT_SELECT)
    .eq('serial_number', clean)
    .maybeSingle()
  if (error) throw unwrapError(error, 'Could not look up serial number')
  return data
}

/**
 * Every installation episode for one asset, current and historical.
 * Reads the v_part_where_used view so the shape matches the reports exactly.
 */
export async function getAssetComponents(assetId) {
  if (!assetId) return []
  const { data, error } = await supabase
    .from('v_part_where_used')
    .select('*')
    .eq('asset_id', assetId)
    .order('installed_at', { ascending: false })
  if (error) throw unwrapError(error, 'Could not load parts for this asset')
  return data || []
}

/** Split helper so pages do not repeat the filter logic. */
export function splitAssetComponents(rows = []) {
  return {
    installed: rows.filter(r => r.is_currently_installed),
    removed: rows.filter(r => !r.is_currently_installed),
    scrapped: rows.filter(r => !r.is_currently_installed && r.current_part_status === 'SCRAPPED'),
  }
}

/** Full immutable event trail for one part, newest first. */
export async function getComponentLifecycle(componentId) {
  const { data, error } = await supabase
    .from('component_lifecycle_events')
    .select(`
      *,
      asset:asset_id ( id, asset_code, asset_name ),
      work_order:work_order_id ( id, work_order_number ),
      performer:performed_by ( id, full_name )
    `)
    .eq('component_id', componentId)
    .order('event_time', { ascending: false })
  if (error) throw unwrapError(error, 'Could not load part history')
  return data || []
}

/** Every asset a given part has ever lived in. */
export async function getComponentWhereUsed(componentId) {
  const { data, error } = await supabase
    .from('v_part_where_used')
    .select('*')
    .eq('component_id', componentId)
    .order('installed_at', { ascending: false })
  if (error) throw unwrapError(error, 'Could not load where-used history')
  return data || []
}

// ═════════════════════════════════════════════════════════════════════════════
// SERIALIZED TRACK  ·  WRITES  (all atomic RPCs)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Book a new serialized part into stock with its full purchase record.
 * Atomic: component row + lifecycle event + inventory transaction, or nothing.
 */
export async function receiveComponent(payload, userId) {
  const uid = userId || payload?.user_id
  requireUser(uid, 'receive a part')

  const body = {
    serial_number: String(payload.serial_number || '').trim(),
    part_number: payload.part_number || null,
    name: String(payload.name || '').trim(),
    category: payload.category || null,
    manufacturer: payload.manufacturer || null,
    model: payload.model || null,
    sku: payload.sku || null,
    purchase_cost: payload.purchase_cost === '' || payload.purchase_cost == null
      ? 0 : Number(payload.purchase_cost),
    currency: payload.currency || 'INR',
    vendor_id: payload.vendor_id || null,
    po_number: payload.po_number || null,
    invoice_number: payload.invoice_number || null,
    purchase_date: payload.purchase_date || null,
    warranty_start: payload.warranty_start || null,
    warranty_end: payload.warranty_end || null,
    current_location: payload.current_location || null,
    site: payload.site || payload.current_location || null,
    unit: payload.unit || 'nos',
    notes: payload.notes || null,
    included_in_asset_cost: payload.included_in_asset_cost !== false,
  }

  if (!body.serial_number) throw new Error('Serial number is required.')
  if (!body.name) throw new Error('Part name is required.')
  if (Number.isNaN(body.purchase_cost)) throw new Error('Purchase cost must be a number.')

  return callRpc('rpc_receive_component', { p_payload: body, p_user_id: uid },
    'Could not receive the part')
}

/**
 * Install an available part into an asset.
 * `workOrderId` tolerates a ticket id: the RPC resolves it to that ticket's work
 * order, creating one if needed. This is what was silently broken before.
 */
export async function installComponent({ componentId, assetId, position, workOrderId, userId, location }) {
  requireUser(userId, 'install a part')
  if (!componentId) throw new Error('Select the part to install.')
  if (!assetId) throw new Error('An asset is required to install a part into.')

  return callRpc('rpc_install_component', {
    p_component_id: componentId,
    p_asset_id: assetId,
    p_position: position || null,
    p_wo_id: workOrderId || null,
    p_user_id: userId,
    p_location: location || null,
  }, 'Could not install the part')
}

/**
 * Take a part out of an asset and decide where it goes.
 * Passing disposition 'SCRAPPED' scraps it in the same transaction, so the
 * removal and the scrap can never disagree.
 */
export async function removeComponent({
  componentId, workOrderId, reason, disposition, userId, newStatus, scrapValue,
}) {
  requireUser(userId, 'remove a part')
  if (!componentId) throw new Error('Select the part to remove.')
  if (!reason || !String(reason).trim()) throw new Error('A reason for removal is required.')

  const status = newStatus || dispositionToStatus(disposition)

  return callRpc('rpc_remove_component', {
    p_component_id: componentId,
    p_wo_id: workOrderId || null,
    p_reason: String(reason).trim(),
    p_disposition: disposition || null,
    p_user_id: userId,
    p_new_status: status,
    p_scrap_value: status === 'SCRAPPED' ? Number(scrapValue || 0) : 0,
  }, 'Could not remove the part')
}

/**
 * The headline flow: swap a failed part for a new one in one transaction.
 * The outgoing part keeps its whole history and its disposition; the incoming
 * part inherits the slot position unless a new one is given.
 */
export async function replaceComponent({
  oldComponentId, newComponentId, assetId, position, workOrderId,
  reason, disposition, userId, oldNewStatus, scrapValue,
}) {
  requireUser(userId, 'replace a part')
  if (!oldComponentId) throw new Error('Select the part being replaced.')
  if (!newComponentId) throw new Error('Select the replacement part.')
  if (oldComponentId === newComponentId) {
    throw new Error('The replacement must be a different part.')
  }
  if (!reason || !String(reason).trim()) throw new Error('A reason for replacement is required.')

  const status = oldNewStatus || dispositionToStatus(disposition)

  return callRpc('rpc_replace_component', {
    p_old_id: oldComponentId,
    p_new_id: newComponentId,
    p_asset_id: assetId,
    p_position: position || null,
    p_wo_id: workOrderId || null,
    p_reason: String(reason).trim(),
    p_disposition: disposition || null,
    p_user_id: userId,
    p_old_new_status: status,
    p_scrap_value: status === 'SCRAPPED' ? Number(scrapValue || 0) : 0,
  }, 'Could not replace the part')
}

/** Scrap a part that is already out of service. Installed parts must be removed first. */
export async function scrapComponent({ componentId, reason, scrapValue, userId }) {
  requireUser(userId, 'scrap a part')
  if (!componentId) throw new Error('Select the part to scrap.')
  if (!reason || !String(reason).trim()) throw new Error('A reason for scrapping is required.')

  return callRpc('rpc_scrap_component', {
    p_component_id: componentId,
    p_reason: String(reason).trim(),
    p_value: Number(scrapValue || 0),
    p_user_id: userId,
  }, 'Could not scrap the part')
}

/** Edit the purchase record on a part. Status is never changed here. */
export async function updateComponentDetails(componentId, patch) {
  const allowed = [
    'name', 'part_number', 'category', 'manufacturer', 'model', 'sku',
    'purchase_cost', 'currency', 'vendor_id', 'po_number', 'invoice_number',
    'purchase_date', 'warranty_start', 'warranty_end', 'current_location',
    'site', 'notes', 'included_in_asset_cost', 'reorder_level', 'unit',
  ]
  const body = {}
  for (const k of allowed) if (k in patch) body[k] = patch[k] === '' ? null : patch[k]
  if (!Object.keys(body).length) return null
  body.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('serialized_components')
    .update(body)
    .eq('id', componentId)
    .select()
    .single()
  if (error) throw unwrapError(error, 'Could not update the part')
  return data
}

/**
 * Flip whether a part's cost counts toward its asset's combined value.
 * true  = capitalised, rolls into combined asset value
 * false = treated as a repair expense
 */
export async function setComponentCapitalisation(componentId, capitalise) {
  return updateComponentDetails(componentId, { included_in_asset_cost: !!capitalise })
}

// ═════════════════════════════════════════════════════════════════════════════
// BULK TRACK
// ═════════════════════════════════════════════════════════════════════════════

/** Catalogue rows. `spareOnly` limits to things maintenance may consume. */
export async function fetchBulkItems({ search, category, spareOnly, activeOnly = true } = {}) {
  let q = supabase.from('bulk_items').select('*')
  if (activeOnly) q = q.eq('is_active', true)
  if (spareOnly) q = q.eq('is_spare_part', true)
  if (category && category !== 'All') q = q.eq('category', category)
  if (search) {
    const s = String(search).trim().replace(/[%,()]/g, '')
    if (s) q = q.or(`item_code.ilike.%${s}%,item_name.ilike.%${s}%,part_number.ilike.%${s}%`)
  }
  const { data, error } = await q.order('item_name')
  if (error) throw unwrapError(error, 'Could not load inventory items')
  return data || []
}

/**
 * Per-site stock with a real reorder flag.
 * Replaces the hardcoded `usableQty < 25` rule with each item's own threshold.
 */
export async function fetchBulkStock({ site, search, category, spareOnly, status } = {}) {
  let q = supabase.from('v_bulk_stock_status').select('*').eq('is_active', true)
  if (site && site !== 'All') q = q.eq('site', site)
  if (category && category !== 'All') q = q.eq('category', category)
  if (spareOnly) q = q.eq('is_spare_part', true)
  if (status && status !== 'All') q = q.eq('stock_status', status)
  if (search) {
    const s = String(search).trim().replace(/[%,()]/g, '')
    if (s) q = q.or(`item_code.ilike.%${s}%,item_name.ilike.%${s}%,part_number.ilike.%${s}%`)
  }
  const { data, error } = await q.order('item_name')
  if (error) throw unwrapError(error, 'Could not load stock levels')
  return data || []
}

export async function upsertBulkItem(payload) {
  const body = {
    item_code: String(payload.item_code || '').trim().toUpperCase(),
    item_name: String(payload.item_name || '').trim(),
    category: payload.category || null,
    part_number: payload.part_number || null,
    manufacturer: payload.manufacturer || null,
    unit: payload.unit || 'pcs',
    unit_price: Number(payload.unit_price || 0),
    unit_weight_kg: Number(payload.unit_weight_kg || 0),
    reorder_level: Number(payload.reorder_level || 0),
    min_order_qty: Number(payload.min_order_qty || 0),
    location_bin: payload.location_bin || null,
    preferred_vendor_id: payload.preferred_vendor_id || null,
    image_url: payload.image_url || null,
    notes: payload.notes || null,
    is_spare_part: !!payload.is_spare_part,
    is_active: payload.is_active !== false,
    updated_at: new Date().toISOString(),
  }
  if (!body.item_code) throw new Error('Item code is required.')
  if (!body.item_name) throw new Error('Item name is required.')

  const { data, error } = await supabase
    .from('bulk_items')
    .upsert(body, { onConflict: 'item_code' })
    .select()
    .single()
  if (error) throw unwrapError(error, 'Could not save the item')
  return data
}

/** Book bulk stock in against a PO. Atomic across stock + both ledgers. */
export async function receiveBulkStock({ itemId, site, quantity, unitPrice, userId, reference, notes }) {
  requireUser(userId, 'receive stock')
  if (!itemId) throw new Error('Select an item.')
  const qty = Number(quantity)
  if (!qty || qty <= 0) throw new Error('Quantity must be greater than zero.')

  return callRpc('rpc_receive_bulk_stock', {
    p_item_id: itemId,
    p_site: site || null,
    p_quantity: qty,
    p_unit_price: unitPrice === '' || unitPrice == null ? null : Number(unitPrice),
    p_user_id: userId,
    p_reference: reference || null,
    p_notes: notes || null,
  }, 'Could not receive stock')
}

/**
 * Consume a bulk part against a work order.
 * Refuses to drive stock negative unless `isOverride` is set with a reason.
 */
export async function consumeBulkPart({
  itemId, quantity, workOrderId, userId, site, isOverride, overrideReason,
}) {
  requireUser(userId, 'consume a part')
  if (!itemId) throw new Error('Select an item.')
  if (!workOrderId) throw new Error('A work order is required to consume a part against.')
  const qty = Number(quantity)
  if (!qty || qty <= 0) throw new Error('Quantity must be greater than zero.')
  if (isOverride && !String(overrideReason || '').trim()) {
    throw new Error('An override reason is required when consuming more than the recorded stock.')
  }

  return callRpc('rpc_consume_bulk_part', {
    p_item_id: itemId,
    p_quantity: qty,
    p_wo_id: workOrderId,
    p_user_id: userId,
    p_site: site || null,
    p_is_override: !!isOverride,
    p_override_reason: overrideReason || null,
  }, 'Could not consume the part')
}

/** Reverse a consumption: wrong item, wrong quantity, or the part came back. */
export async function returnBulkPart({ transactionId, userId, reason }) {
  requireUser(userId, 'return a part')
  if (!transactionId) throw new Error('Select the consumption to reverse.')
  return callRpc('rpc_return_bulk_part', {
    p_transaction_id: transactionId,
    p_user_id: userId,
    p_reason: reason || null,
  }, 'Could not reverse the consumption')
}

// ═════════════════════════════════════════════════════════════════════════════
// WORK ORDER PARTS
// ═════════════════════════════════════════════════════════════════════════════

/** Everything consumed against one work order, across both tracks. */
export async function getWorkOrderParts(workOrderId) {
  if (!workOrderId) return []
  const { data, error } = await supabase
    .from('v_work_order_parts')
    .select('*')
    .eq('work_order_id', workOrderId)
    .order('transaction_at', { ascending: false })
  if (error) throw unwrapError(error, 'Could not load parts for this work order')
  return data || []
}

/** Running parts cost for a work order, split by track. */
export function summariseWorkOrderParts(rows = []) {
  const serialized = rows.filter(r => r.track === 'serialized')
  const bulk = rows.filter(r => r.track === 'bulk')
  const sum = list => list.reduce((t, r) => t + Number(r.total_cost || 0), 0)
  return {
    serializedCount: serialized.length,
    bulkCount: bulk.length,
    serializedCost: sum(serialized),
    bulkCost: sum(bulk),
    totalCost: sum(rows),
    lineCount: rows.length,
  }
}

/** Audit trail for a work order, for the history tab. */
export async function getWorkOrderAudit(workOrderId) {
  if (!workOrderId) return []
  const { data, error } = await supabase
    .from('maintenance_audit_events')
    .select('*, actor:actor_id ( id, full_name )')
    .eq('entity_type', 'work_order')
    .eq('entity_id', workOrderId)
    .order('created_at', { ascending: false })
  if (error) throw unwrapError(error, 'Could not load work order history')
  return data || []
}

/** Next sequential work order number. Replaces the Math.random() generator. */
export async function nextWorkOrderNumber() {
  const { data, error } = await supabase.rpc('rpc_next_work_order_number')
  if (error) {
    // Non-fatal: let the DB default handle it rather than blocking the user
    console.warn('Could not reserve a work order number:', error.message)
    return null
  }
  return data
}

// ═════════════════════════════════════════════════════════════════════════════
// ASSET COST ROLLUP
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Combined value and parts spend for one asset.
 *
 *   original_value   what the asset itself cost
 *   capitalized_parts  parts flagged as adding to asset value
 *   expensed_parts     parts treated as a repair expense
 *   consumables_spend  bulk parts consumed
 *   combined_value     original + capitalised  ← the headline figure
 *   total_cost_of_ownership  original + all parts + labour
 */
export async function getAssetCostSummary(assetId) {
  if (!assetId) return null
  const { data, error } = await supabase
    .from('v_asset_total_cost')
    .select('*')
    .eq('asset_id', assetId)
    .maybeSingle()
  if (error) throw unwrapError(error, 'Could not load asset cost summary')
  return data
}

/** Same rollup for many assets at once, for lists and reports. */
export async function getAssetCostSummaries({ assetIds, companyCode, limit = 1000 } = {}) {
  let q = supabase.from('v_asset_total_cost').select('*')
  if (assetIds?.length) q = q.in('asset_id', assetIds)
  if (companyCode) q = q.eq('company_code', companyCode)
  const { data, error } = await q.order('total_cost_of_ownership', { ascending: false }).limit(limit)
  if (error) throw unwrapError(error, 'Could not load asset cost summaries')
  return data || []
}

// ═════════════════════════════════════════════════════════════════════════════
// REPORTING READS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Where-used register: one row per installation episode.
 * This is the report answering "which laptop was this hard drive in, what did it
 * cost, and did it end up in scrap".
 */
export async function fetchPartWhereUsed({
  assetId, componentId, category, site, currentlyInstalled,
  from, to, companyCode, limit = 5000,
} = {}) {
  let q = supabase.from('v_part_where_used').select('*')
  if (assetId) q = q.eq('asset_id', assetId)
  if (componentId) q = q.eq('component_id', componentId)
  if (category && category !== 'All') q = q.eq('part_category', category)
  if (site && site !== 'All') q = q.eq('asset_site', site)
  if (companyCode) q = q.eq('company_code', companyCode)
  if (currentlyInstalled === true) q = q.is('removed_at', null)
  if (currentlyInstalled === false) q = q.not('removed_at', 'is', null)
  if (from) q = q.gte('installed_at', from)
  if (to) q = q.lte('installed_at', to)
  const { data, error } = await q.order('installed_at', { ascending: false }).limit(limit)
  if (error) throw unwrapError(error, 'Could not load the part history report')
  return data || []
}

/** Scrap register with book loss per part. */
export async function fetchScrappedParts({ category, from, to, limit = 5000 } = {}) {
  let q = supabase.from('v_scrapped_parts').select('*')
  if (category && category !== 'All') q = q.eq('category', category)
  if (from) q = q.gte('scrapped_at', from)
  if (to) q = q.lte('scrapped_at', to)
  const { data, error } = await q.order('scrapped_at', { ascending: false, nullsFirst: false }).limit(limit)
  if (error) throw unwrapError(error, 'Could not load the scrap report')
  return data || []
}

/** Consumption ledger across both tracks, for cost analysis. */
export async function fetchPartsConsumption({ assetId, workOrderId, from, to, track, limit = 5000 } = {}) {
  let q = supabase.from('v_work_order_parts').select('*')
  if (assetId) q = q.eq('asset_id', assetId)
  if (workOrderId) q = q.eq('work_order_id', workOrderId)
  if (track) q = q.eq('track', track)
  if (from) q = q.gte('transaction_at', from)
  if (to) q = q.lte('transaction_at', to)
  const { data, error } = await q.order('transaction_at', { ascending: false }).limit(limit)
  if (error) throw unwrapError(error, 'Could not load parts consumption')
  return data || []
}

/** Inventory-wide KPI strip. */
export async function getPartsInventoryStats() {
  const [serial, stock] = await Promise.all([
    supabase.from('serialized_components').select('status, purchase_cost, scrap_value'),
    supabase.from('v_bulk_stock_status').select('stock_status, stock_value, usable_qty'),
  ])
  if (serial.error) throw unwrapError(serial.error, 'Could not load inventory statistics')
  if (stock.error) throw unwrapError(stock.error, 'Could not load stock statistics')

  const comps = serial.data || []
  const rows = stock.data || []
  const countBy = s => comps.filter(c => c.status === s).length

  return {
    serialized: {
      total: comps.length,
      available: countBy('AVAILABLE'),
      installed: countBy('INSTALLED'),
      underRepair: countBy('UNDER_REPAIR'),
      scrapped: countBy('SCRAPPED'),
      stockValue: comps
        .filter(c => ['AVAILABLE', 'RESERVED'].includes(c.status))
        .reduce((t, c) => t + Number(c.purchase_cost || 0), 0),
      installedValue: comps
        .filter(c => c.status === 'INSTALLED')
        .reduce((t, c) => t + Number(c.purchase_cost || 0), 0),
      scrapLoss: comps
        .filter(c => c.status === 'SCRAPPED')
        .reduce((t, c) => t + (Number(c.purchase_cost || 0) - Number(c.scrap_value || 0)), 0),
    },
    bulk: {
      lines: rows.length,
      outOfStock: rows.filter(r => r.stock_status === 'OUT_OF_STOCK').length,
      lowStock: rows.filter(r => r.stock_status === 'LOW_STOCK').length,
      stockValue: rows.reduce((t, r) => t + Number(r.stock_value || 0), 0),
    },
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// LOOKUPS
// ═════════════════════════════════════════════════════════════════════════════

export async function fetchVendorsLite() {
  const { data, error } = await supabase
    .from('vendors')
    .select('id, name')
    .order('name')
  if (error) return []
  return data || []
}

/** Assets for install pickers. Terminal/scrapped assets are excluded. */
export async function fetchAssetsLite({ search, companyCode, limit = 200 } = {}) {
  let q = supabase
    .from('assets')
    .select('id, asset_code, asset_name, site, location, category, status')
    .neq('status', 'Disposed')
  if (companyCode) q = q.eq('company_code', companyCode)
  if (search) {
    const s = String(search).trim().replace(/[%,()]/g, '')
    if (s) q = q.or(`asset_code.ilike.%${s}%,asset_name.ilike.%${s}%,serial_no.ilike.%${s}%`)
  }
  const { data, error } = await q.order('asset_code').limit(limit)
  if (error) throw unwrapError(error, 'Could not load assets')
  return data || []
}

/** Open work orders for an asset, so parts activity can be attributed correctly. */
export async function fetchOpenWorkOrdersForAsset(assetId) {
  if (!assetId) return []
  const { data, error } = await supabase
    .from('maintenance_work_orders')
    .select('id, work_order_number, status, description, scheduled_start')
    .eq('asset_id', assetId)
    .not('status', 'in', '("CLOSED","CANCELLED")')
    .order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

/**
 * Every site name a part can sit in: the site master plus any site that already
 * holds bulk stock or a serialized part. Used by the site pickers so a store
 * that was typed in before it was configured never disappears from the list.
 * Resilient by design — a failing source contributes nothing rather than
 * blanking the picker.
 */
export async function fetchPartsSites() {
  const [master, stock, parts] = await Promise.all([
    supabase.from('sites').select('name'),
    supabase.from('bulk_site_stock').select('site'),
    supabase.from('serialized_components').select('site'),
  ])
  const names = new Set()
  ;(master.data || []).forEach(r => { if (r.name) names.add(r.name) })
  ;(stock.data || []).forEach(r => { if (r.site) names.add(r.site) })
  ;(parts.data || []).forEach(r => { if (r.site) names.add(r.site) })
  return [...names].sort((a, b) => a.localeCompare(b))
}

/**
 * Per-site stock rows keyed the way the older gate-pass / issue-slip components
 * expect (`id` = the bulk_site_stock row id). Still reads v_bulk_stock_status, so
 * the reorder flag stays authoritative.
 */
export async function fetchBulkSiteStockRows(filters = {}) {
  const rows = await fetchBulkStock(filters)
  return rows.map(r => ({ ...r, id: r.stock_id }))
}

/**
 * The replacement chain a part belongs to, in both directions: what it replaced
 * and what replaced it. rpc_replace_component writes one component_replacements
 * row per swap, so following this chain reconstructs the whole "hard drive was
 * scrapped, this one took its place" story.
 */
export async function getComponentReplacementChain(componentId) {
  if (!componentId) return []
  const { data, error } = await supabase
    .from('component_replacements')
    .select(`
      id, old_component_id, new_component_id, replaced_at, reason, notes,
      old_comp:old_component_id ( id, name, serial_number, status, purchase_cost, scrap_value ),
      new_comp:new_component_id ( id, name, serial_number, status, purchase_cost ),
      work_order:work_order_id ( id, work_order_number )
    `)
    .or(`old_component_id.eq.${componentId},new_component_id.eq.${componentId}`)
    .order('replaced_at', { ascending: false })
  if (error) throw unwrapError(error, 'Could not load the replacement chain')
  return data || []
}

/**
 * Parts roll-up for a *list* of work orders in one round trip, so a Kanban board
 * or a dashboard table can show "3 parts · ₹8,400" per card without firing one
 * query per row.
 *
 * Returns a plain object keyed by work_order_id whose values are exactly what
 * summariseWorkOrderParts() produces, so callers can treat both the single and
 * the batch path identically. Work orders with no parts are simply absent — read
 * them with a `?? EMPTY_PARTS_SUMMARY` style fallback.
 *
 * Resilient by design: a failure returns an empty map rather than blowing up the
 * board, because the parts figure is decoration on top of the work order list.
 */
export async function getWorkOrderPartsSummaries(workOrderIds = []) {
  const ids = [...new Set((workOrderIds || []).filter(Boolean))]
  if (!ids.length) return {}
  const { data, error } = await supabase
    .from('v_work_order_parts')
    .select('work_order_id, track, total_cost')
    .in('work_order_id', ids)
  if (error) {
    console.warn('Could not load parts totals for the work order list:', error.message)
    return {}
  }
  const byWorkOrder = {}
  ;(data || []).forEach(row => {
    if (!byWorkOrder[row.work_order_id]) byWorkOrder[row.work_order_id] = []
    byWorkOrder[row.work_order_id].push(row)
  })
  const out = {}
  Object.keys(byWorkOrder).forEach(id => {
    out[id] = summariseWorkOrderParts(byWorkOrder[id])
  })
  return out
}

/** The shape getWorkOrderPartsSummaries() omits for a work order with no parts. */
export const EMPTY_PARTS_SUMMARY = {
  serializedCount: 0,
  bulkCount: 0,
  serializedCost: 0,
  bulkCost: 0,
  totalCost: 0,
  lineCount: 0,
}

/**
 * Every parts line booked against *any* work order belonging to a ticket.
 *
 * Parts always hang off a work order, never a ticket — but a technician working
 * a ticket does not care about that distinction, and fn_resolve_work_order will
 * happily create or reuse a work order when it is handed a ticket id. That means
 * one ticket can accumulate lines across more than one work order, so filtering
 * v_work_order_parts by ticket_id (rather than work_order_id) is the only way to
 * show the technician everything they consumed on the job in front of them.
 */
export async function getTicketParts(ticketId) {
  if (!ticketId) return []
  const { data, error } = await supabase
    .from('v_work_order_parts')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('transaction_at', { ascending: false })
  if (error) throw unwrapError(error, 'Could not load parts for this ticket')
  return data || []
}

/**
 * Work orders attached to a ticket, newest first.
 *
 * Used to tell the user when a work order was created for them: booking a part
 * against a ticket silently spawns one ("Auto-created for parts activity on
 * ticket …"), and a work order appearing out of nowhere is alarming if nothing
 * says why.
 */
export async function getTicketWorkOrders(ticketId) {
  if (!ticketId) return []
  const { data, error } = await supabase
    .from('maintenance_work_orders')
    .select('id, work_order_number, status, description, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('Could not load work orders for this ticket:', error.message)
    return []
  }
  return data || []
}

