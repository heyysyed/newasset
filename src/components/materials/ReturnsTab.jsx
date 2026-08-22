import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus, Search, Loader2, RotateCcw,
  Store, Truck, CheckCircle2,
  XCircle, User, Trash2, X,
  ArrowLeftRight, MapPin,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ModalShell from './ModalShell'
import { fmtDate, generateDocNo, trashSave } from './helpers'

const CONDITION_CONFIG = {
  good:    { label: 'Good',    color: 'var(--green)', bg: 'var(--green-dim)', icon: CheckCircle2 },
  damaged: { label: 'Damaged', color: 'var(--red)',   bg: 'var(--red-dim)',   icon: XCircle },
  partial: { label: 'Partial', color: 'var(--amber)', bg: 'var(--amber-dim)', icon: undefined },
}

const RETURN_TYPE_LABELS = {
  to_store:      'To Store',
  to_vendor:     'To Vendor',
  between_sites: 'Between Sites',
}

const RETURN_TYPE_ICONS = {
  to_store:      Store,
  to_vendor:     Truck,
  between_sites: ArrowLeftRight,
}

// ── Condition Badge ───────────────────────────────────────────────────────────

function ConditionBadge({ condition }) {
  const cfg = CONDITION_CONFIG[condition]
  if (!cfg) return <span className="badge">{condition}</span>
  const Icon = cfg.icon
  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon size={12} />
      {cfg.label}
    </span>
  )
}

// ── Return Type Badge ─────────────────────────────────────────────────────────

function ReturnTypeBadge({ type }) {
  const label = RETURN_TYPE_LABELS[type] || type
  const Icon = RETURN_TYPE_ICONS[type] || RotateCcw
  const colorMap = { to_store: 'var(--green)', to_vendor: 'var(--amber)', between_sites: 'var(--cyan)' }
  const bgMap = { to_store: 'var(--green-dim)', to_vendor: 'var(--amber-dim)', between_sites: 'var(--cyan-dim)' }
  return (
    <span className="badge" style={{ background: bgMap[type] || 'var(--bg-3)', color: colorMap[type] || 'var(--text-2)',
      display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon size={12} />
      {label}
    </span>
  )
}

// ── Create Return Modal ───────────────────────────────────────────────────────

function CreateReturnModal({ onClose, materials, sites, onSubmit }) {
  const [form, setForm] = useState({
    material_id: '',
    site: '',
    quantity: '',
    return_type: 'to_store',
    returned_from: '',
    condition: 'good',
    reason: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const siteLabel = form.return_type === 'to_vendor' ? 'Return From Site' : 'Return To Site'

  const valid = form.material_id && form.site && Number(form.quantity) > 0 && form.returned_from.trim()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    try {
      await onSubmit(form)
      onClose()
    } catch (err) {
      console.error('Return submit error:', err)
      alert('Failed to create return: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  const selectedMat = materials.find(m => m.id === form.material_id)

  return (
    <ModalShell onClose={onClose} accent="var(--accent)">
      <h3 style={{ textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 20, color: 'var(--text-0)' }}>
        <RotateCcw size={18} style={{ marginRight: 8, verticalAlign: 'middle', color: 'var(--accent)' }} />
        New Material Return
      </h3>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Material */}
        <div>
          <label className="lbl">Material *</label>
          <select className="sel" value={form.material_id} onChange={e => set('material_id', e.target.value)}>
            <option value="">Select material...</option>
            {materials.map(m => (
              <option key={m.id} value={m.id}>
                {m.material_code} - {m.material_name}
              </option>
            ))}
          </select>
        </div>

        {/* Return Type */}
        <div>
          <label className="lbl">Return Type *</label>
          <select className="sel" value={form.return_type} onChange={e => set('return_type', e.target.value)}>
            <option value="to_store">To Store</option>
            <option value="to_vendor">To Vendor</option>
            <option value="between_sites">Between Sites</option>
          </select>
        </div>

        {/* Site */}
        <div>
          <label className="lbl">{siteLabel} *</label>
          <select className="sel" value={form.site} onChange={e => set('site', e.target.value)}>
            <option value="">Select site...</option>
            {sites.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Quantity */}
        <div>
          <label className="lbl">Quantity {selectedMat ? `(${selectedMat.unit})` : ''} *</label>
          <input className="inp" type="number" min="0.01" step="any" placeholder="Enter quantity"
            value={form.quantity} onChange={e => set('quantity', e.target.value)} />
        </div>

        {/* Returned From */}
        <div>
          <label className="lbl">Returned From (Person / Contractor) *</label>
          <input className="inp" type="text" placeholder="Name of person or contractor"
            value={form.returned_from} onChange={e => set('returned_from', e.target.value)} />
        </div>

        {/* Condition */}
        <div>
          <label className="lbl">Condition *</label>
          <select className="sel" value={form.condition} onChange={e => set('condition', e.target.value)}>
            <option value="good">Good</option>
            <option value="damaged">Damaged</option>
            <option value="partial">Partial</option>
          </select>
        </div>

        {/* Reason */}
        <div>
          <label className="lbl">Reason</label>
          <input className="inp" type="text" placeholder="Reason for return"
            value={form.reason} onChange={e => set('reason', e.target.value)} />
        </div>

        {/* Notes */}
        <div>
          <label className="lbl">Notes</label>
          <textarea className="inp" rows={3} placeholder="Additional notes..."
            value={form.notes} onChange={e => set('notes', e.target.value)}
            style={{ resize: 'vertical' }} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!valid || saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving ? <Loader2 size={15} className="spin" /> : <RotateCcw size={15} />}
            {saving ? 'Saving...' : 'Create Return'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ReturnsTab({ materials, stock, sites, onRefresh }) {
  const { user } = useAuth()
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  // ── Fetch returns ─────────────────────────────────────────────────────────

  const fetchReturns = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('material_returns')
        .select('*, materials(material_name, material_code, unit)')
        .order('created_at', { ascending: false })
      if (error) throw error

      // Fetch returner names separately (FK points to auth.users not profiles)
      if (data?.length) {
        const userIds = [...new Set(data.map(r => r.returned_by).filter(Boolean))]
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]))
        for (const r of data) {
          r.returner = { full_name: profileMap[r.returned_by] || null }
        }
      }
      setReturns(data || [])
    } catch (err) {
      console.error('Error fetching returns:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReturns() }, [fetchReturns])

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = returns.length
    const toStore = returns.filter(r => r.return_type === 'to_store').length
    const toVendor = returns.filter(r => r.return_type === 'to_vendor').length
    const damaged = returns.filter(r => r.condition === 'damaged').length
    return { total, toStore, toVendor, damaged }
  }, [returns])

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search.trim()) return returns
    const q = search.toLowerCase()
    return returns.filter(r =>
      (r.return_no || '').toLowerCase().includes(q) ||
      (r.materials?.material_name || '').toLowerCase().includes(q) ||
      (r.materials?.material_code || '').toLowerCase().includes(q) ||
      (r.site || '').toLowerCase().includes(q) ||
      (r.returned_from || '').toLowerCase().includes(q) ||
      (r.reason || '').toLowerCase().includes(q)
    )
  }, [returns, search])

  // ── Submit handler ────────────────────────────────────────────────────────

  async function handleCreateReturn(form) {
    const return_no = generateDocNo('RET')
    const qty = Number(form.quantity)

    // Insert material_returns
    const { error: retErr } = await supabase
      .from('material_returns')
      .insert({
        return_no,
        material_id: form.material_id,
        site: form.site,
        quantity: qty,
        return_type: form.return_type,
        returned_from: form.returned_from.trim(),
        reason: form.reason.trim() || null,
        condition: form.condition,
        notes: form.notes.trim() || null,
        returned_by: user?.id,
      })

    if (retErr) throw retErr

    // Update stock: add for to_store and between_sites, skip for to_vendor
    if (form.return_type === 'to_store' || form.return_type === 'between_sites') {
      const existing = stock.find(s => s.material_id === form.material_id && s.site === form.site)
      if (existing) {
        const { error: stockErr } = await supabase
          .from('material_site_stock')
          .update({ quantity: existing.quantity + qty })
          .eq('id', existing.id)
        if (stockErr) throw stockErr
      } else {
        const { error: stockErr } = await supabase
          .from('material_site_stock')
          .upsert({ material_id: form.material_id, site: form.site, quantity: qty },
            { onConflict: 'material_id,site' })
        if (stockErr) throw stockErr
      }
    }

    // Get unit_cost for transaction log
    const mat = materials.find(m => m.id === form.material_id)
    const unitCost = mat?.unit_cost || 0

    // Log transaction
    const txn = {
      material_id: form.material_id,
      transaction_type: 'return',
      quantity: qty,
      notes: `Return ${return_no} - ${RETURN_TYPE_LABELS[form.return_type]} - from ${form.returned_from.trim()}${form.reason ? ' - ' + form.reason.trim() : ''}`,
      performed_by: user?.id,
      unit_cost: unitCost,
    }

    if (form.return_type === 'to_vendor') {
      txn.from_site = form.site
      txn.to_site = 'Vendor'
    } else {
      txn.from_site = form.returned_from.trim() || 'Return'
      txn.to_site = form.site
    }

    const { error: txnErr } = await supabase
      .from('material_transactions')
      .insert(txn)

    if (txnErr) throw txnErr

    await fetchReturns()
    onRefresh()
  }

  const toggleOne = id => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAll = () => setSelectedIds(prev => prev.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(r => r.id)))
  const clearSel = () => setSelectedIds(new Set())

  async function handleBulkDelete(ids) {
    if (!confirm(`Delete ${ids.length} return record(s)?\n\nThey will be saved to Recycle Bin for recovery.`)) return
    try {
      const records = filtered.filter(r => ids.includes(r.id))
      trashSave('material_returns', 'Return', records)
      const { error } = await supabase.from('material_returns').delete().in('id', ids)
      if (error) throw error
      clearSel()
      fetchReturns()
    } catch (e) { alert(e.message) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="mat-sub-stats">
        <div className="mat-sub-stat" data-accent="accent">
          <div className="mat-sub-stat-icon"><RotateCcw size={18} /></div>
          <div className="mat-sub-stat-val">{stats.total}</div>
          <div className="mat-sub-stat-label">Total Returns</div>
        </div>
        <div className="mat-sub-stat" data-accent="green">
          <div className="mat-sub-stat-icon"><Store size={18} /></div>
          <div className="mat-sub-stat-val">{stats.toStore}</div>
          <div className="mat-sub-stat-label">To Store</div>
        </div>
        <div className="mat-sub-stat" data-accent="amber">
          <div className="mat-sub-stat-icon"><Truck size={18} /></div>
          <div className="mat-sub-stat-val">{stats.toVendor}</div>
          <div className="mat-sub-stat-label">To Vendor</div>
        </div>
        <div className="mat-sub-stat" data-accent="red">
          <div className="mat-sub-stat-icon"><XCircle size={18} /></div>
          <div className="mat-sub-stat-val">{stats.damaged}</div>
          <div className="mat-sub-stat-label">Damaged</div>
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 16px' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input className="inp" placeholder="Search returns..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 34, width: '100%' }} />
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <Plus size={15} /> New Return
        </button>
      </div>

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'var(--red-dim)', borderBottom:'1px solid var(--status-danger-soft)' }}>
          <span style={{ color:'var(--red)', }}>{selectedIds.size} return{selectedIds.size > 1 ? 's' : ''} selected</span>
          <button onClick={() => handleBulkDelete([...selectedIds])}
            style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:10, background:'var(--red)', border:'none', color:'white', cursor:'pointer', }}>
            <Trash2 size={13}/> Delete Selected
          </button>
          <button onClick={clearSel}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:10, background:'var(--bg-3)', border:'1.5px solid var(--border)', color:'var(--text-2)', cursor:'pointer', }}>
            <X size={13}/> Cancel
          </button>
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, color: 'var(--text-3)' }}>
          <Loader2 size={22} className="spin" style={{ marginRight: 8 }} />
          Loading returns...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-3)' }}>
          <RotateCcw size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ textTransform: 'uppercase', marginBottom: 4 }}>
            {search ? 'No matching returns' : 'No returns yet'}
          </div>
          <div >
            {search ? 'Try adjusting your search' : 'Click "New Return" to record a material return'}
          </div>
        </div>
      ) : (
        <>
          {/* ── Desktop Table ──────────────────────────────────────────── */}
          <div className="card desktop-table" style={{ overflow: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width:36 }}><input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} style={{ cursor:'pointer' }}/></th>
                  <th>Date</th>
                  <th>Return No</th>
                  <th>Material</th>
                  <th>Site</th>
                  <th>Qty</th>
                  <th>Type</th>
                  <th>Returned From</th>
                  <th>Condition</th>
                  <th>Reason</th>
                  <th style={{ textAlign:'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const mat = r.materials || {}
                  return (
                    <tr key={r.id} style={{ background: selectedIds.has(r.id) ? 'var(--status-danger-soft)' : undefined }}>
                      <td><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor:'pointer' }}/></td>
                      <td style={{ whiteSpace: 'nowrap', }}>{fmtDate(r.created_at)}</td>
                      <td style={{ color: 'var(--accent)' }}>{r.return_no}</td>
                      <td>
                        <div >{mat.material_name || '-'}</div>
                        <div style={{ color: 'var(--text-3)', }}>{mat.material_code || ''}</div>
                      </td>
                      <td >{r.site || '-'}</td>
                      <td >
                        {r.quantity} <span style={{ color: 'var(--text-3)', }}>{mat.unit || ''}</span>
                      </td>
                      <td><ReturnTypeBadge type={r.return_type} /></td>
                      <td >{r.returned_from || '-'}</td>
                      <td><ConditionBadge condition={r.condition} /></td>
                      <td style={{ color: 'var(--text-2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.reason || '-'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => handleBulkDelete([r.id])} title="Delete"
                          style={{ padding: '5px 7px', borderRadius: 8, background: 'var(--red-dim)',
                            border: '1.5px solid var(--status-danger-soft)', cursor: 'pointer', color: 'var(--red)' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Cards ───────────────────────────────────────────── */}
          <div className="mobile-cards" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(r => {
              const mat = r.materials || {}
              return (
                <div key={r.id} className="card" style={{ padding: '14px 16px' }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ color: 'var(--accent)', }}>{r.return_no}</span>
                    <span style={{ color: 'var(--text-3)' }}>{fmtDate(r.created_at)}</span>
                  </div>

                  {/* Material */}
                  <div style={{ marginBottom: 4 }}>{mat.material_name || '-'}</div>
                  <div style={{ color: 'var(--text-3)', marginBottom: 10 }}>{mat.material_code || ''}</div>

                  {/* Info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', }}>
                    <div>
                      <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>Site</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} style={{ color: 'var(--text-3)' }} />
                        {r.site || '-'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>Quantity</div>
                      <div >
                        {r.quantity} <span style={{ color: 'var(--text-3)', }}>{mat.unit || ''}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>Returned From</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={12} style={{ color: 'var(--text-3)' }} />
                        {r.returned_from || '-'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>Reason</div>
                      <div style={{ color: 'var(--text-2)' }}>{r.reason || '-'}</div>
                    </div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <ReturnTypeBadge type={r.return_type} />
                    <ConditionBadge condition={r.condition} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateReturnModal
          onClose={() => setShowCreate(false)}
          materials={materials}
          sites={sites}
          onSubmit={handleCreateReturn}
        />
      )}
    </div>
  )
}
