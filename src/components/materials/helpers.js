/* ─── Recycle Bin (localStorage) ────────────────────────────────────────────
   Records deleted via bulk-delete are saved here before actual deletion.
   Each entry: { trashId, tableName, label, displayName, record, deletedAt }
   ─────────────────────────────────────────────────────────────────────────── */

const TRASH_KEY = 'assetpro_mat_trash'
const TRASH_LIMIT = 2000   // max records kept

// Join fields that must be stripped before re-inserting into Supabase
const JOIN_FIELDS = {
  material_site_stock:   ['materials'],
  materials:             [],
  material_requisitions: ['materials', 'requester', 'approver'],
  material_transactions: ['materials', 'performer'],
  material_issue_slips:  ['materials', 'issuer'],
  material_returns:      ['materials', 'returner'],
  material_consumption:  ['materials', 'logger'],
  material_transfers:    ['materials', 'initiator', 'confirmer'],
}

/** Returns a short human-readable name for display in the trash list */
export function trashDisplayName(tableName, record) {
  const m = record.materials || {}
  switch (tableName) {
    case 'material_site_stock':
      return `${m.material_name || '?'} @ ${record.site || '?'}`
    case 'materials':
      return record.material_name || record.material_code || '?'
    case 'material_requisitions':
      return `${m.material_name || '?'} — ${record.from_site} → ${record.to_site}`
    case 'material_transactions':
      return `${m.material_name || '?'} (${record.transaction_type})`
    case 'material_issue_slips':
      return `${record.slip_no || '?'} — ${m.material_name || '?'}`
    case 'material_returns':
      return `${record.return_no || '?'} — ${m.material_name || '?'}`
    case 'material_consumption':
      return `${record.consumption_no || '?'} — ${m.material_name || '?'}`
    case 'material_transfers':
      return `${record.gate_pass_no || record.transfer_no || '?'} (${record.from_site} → ${record.to_site})`
    default:
      return record.id || '?'
  }
}

/** Strip joined/computed fields so the record can be re-inserted into Supabase */
export function trashCleanRecord(tableName, record) {
  const clean = { ...record }
  ;(JOIN_FIELDS[tableName] || []).forEach(f => delete clean[f])
  return clean
}

/** Save records to trash before deleting */
export function trashSave(tableName, label, records) {
  try {
    const now = new Date().toISOString()
    const existing = trashGet()
    const items = records.map(r => ({
      trashId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tableName,
      label,
      displayName: trashDisplayName(tableName, r),
      record: r,
      deletedAt: now,
    }))
    const updated = [...items, ...existing].slice(0, TRASH_LIMIT)
    localStorage.setItem(TRASH_KEY, JSON.stringify(updated))
  } catch (e) {
    console.warn('Trash save failed:', e)
  }
}

export function trashGet() {
  try { return JSON.parse(localStorage.getItem(TRASH_KEY) || '[]') } catch { return [] }
}

export function trashRemove(trashIds) {
  const set = new Set(trashIds)
  localStorage.setItem(TRASH_KEY, JSON.stringify(trashGet().filter(i => !set.has(i.trashId))))
}

export function trashClear() {
  localStorage.removeItem(TRASH_KEY)
}

export function trashCount() {
  return trashGet().length
}

export function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function fmtCurrency(val) {
  if (val == null) return '—'
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtQty(v) {
  if (v == null) return '0'
  return Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function generateDocNo(prefix) {
  const d = new Date()
  const date = d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')
  return `${prefix}-${date}-${seq}`
}


