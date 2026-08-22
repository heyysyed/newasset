import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus, Search, Loader2, Package, MapPin, User,
  FileText, AlertTriangle, Flame, CalendarDays, IndianRupee, Building2, Trash2, X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ModalShell from './ModalShell'
import { trashSave } from './helpers'

// ── Log Consumption Modal ──────────────────────────────────────────────────────

function LogConsumptionModal({ materials, stock, sites, userId, onClose, onSaved }) {
  const [materialId, setMaterialId] = useState('')
  const [site, setSite] = useState('')
  const [quantity, setQuantity] = useState('')
  const [purpose, setPurpose] = useState('')
  const [workArea, setWorkArea] = useState('')
  const [consumedBy, setConsumedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Sites that have stock for the selected material
  const availableSites = useMemo(() => {
    if (!materialId) return []
    return stock
      .filter(s => s.material_id === materialId && s.quantity > 0)
      .map(s => s.site)
      .filter(s => sites.includes(s))
  }, [materialId, stock, sites])

  // Current available qty at selected site
  const availableQty = useMemo(() => {
    if (!materialId || !site) return 0
    const entry = stock.find(s => s.material_id === materialId && s.site === site)
    return entry ? Number(entry.quantity) : 0
  }, [materialId, site, stock])

  // Selected material details
  const selectedMaterial = useMemo(
    () => materials.find(m => m.id === materialId),
    [materialId, materials],
  )

  // Reset site when material changes
  useEffect(() => { setSite('') }, [materialId])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const qty = Number(quantity)
    if (!materialId) return setError('Please select a material.')
    if (!site) return setError('Please select a site.')
    if (!qty || qty <= 0) return setError('Quantity must be greater than 0.')
    if (qty > availableQty) return setError(`Insufficient stock. Available: ${availableQty}`)
    if (!consumedBy.trim()) return setError('Please enter "Consumed By" name.')

    setSaving(true)
    try {
      // Generate consumption number: CON-YYYYMMDD-NNN
      const today = new Date()
      const datePart = today.toISOString().slice(0, 10).replace(/-/g, '')
      const { count, error: countErr } = await supabase
        .from('material_consumption')
        .select('id', { count: 'exact', head: true })
      if (countErr) throw countErr
      const consumptionNo = `CON-${datePart}-${String((count || 0) + 1).padStart(3, '0')}`

      // Get unit_cost for the transaction
      const unitCost = selectedMaterial?.unit_cost || 0

      // 1. Deduct stock
      const stockRow = stock.find(s => s.material_id === materialId && s.site === site)
      if (!stockRow) throw new Error('Stock record not found.')
      const newQty = Number(stockRow.quantity) - qty
      if (newQty < 0) throw new Error('Insufficient stock.')

      const { error: stockErr } = await supabase
        .from('material_site_stock')
        .update({ quantity: newQty })
        .eq('id', stockRow.id)
      if (stockErr) throw stockErr

      // 2. Insert consumption record
      const { error: conErr } = await supabase
        .from('material_consumption')
        .insert({
          consumption_no: consumptionNo,
          material_id: materialId,
          site,
          quantity: qty,
          purpose: purpose.trim() || null,
          work_area: workArea.trim() || null,
          consumed_by: consumedBy.trim(),
          notes: notes.trim() || null,
          logged_by: userId,
        })
      if (conErr) throw conErr

      // 3. Insert transaction log
      const { error: txErr } = await supabase
        .from('material_transactions')
        .insert({
          material_id: materialId,
          transaction_type: 'consumption',
          from_site: site,
          to_site: null,
          quantity: qty,
          notes: `Consumption ${consumptionNo} - ${purpose || 'N/A'}`.slice(0, 500),
          performed_by: userId,
          unit_cost: unitCost,
        })
      if (txErr) throw txErr

      onSaved()
    } catch (err) {
      console.error('Consumption error:', err)
      setError(err.message || 'Failed to log consumption.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell onClose={onClose} accent="var(--red)">
      <h3 style={{ marginBottom: 18, paddingRight: 32 }}>
        Log Material Consumption
      </h3>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Material */}
        <div>
          <label className="lbl" style={{ marginBottom: 4, display: 'block' }}>
            Material *
          </label>
          <select className="sel" value={materialId} onChange={e => setMaterialId(e.target.value)} required
            style={{ height: 38, }}>
            <option value="">Select material...</option>
            {materials.filter(m => !m.is_reusable).map(m => (
              <option key={m.id} value={m.id}>
                {m.material_code} - {m.material_name} ({m.unit})
              </option>
            ))}
          </select>
        </div>

        {/* Site */}
        <div>
          <label className="lbl" style={{ marginBottom: 4, display: 'block' }}>
            Site *
          </label>
          <select className="sel" value={site} onChange={e => setSite(e.target.value)} required
            disabled={!materialId} style={{ height: 38, }}>
            <option value="">{materialId ? 'Select site...' : 'Select a material first'}</option>
            {availableSites.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {materialId && availableSites.length === 0 && (
            <div style={{ marginTop: 4, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={12} /> No sites have stock for this material
            </div>
          )}
        </div>

        {/* Available Stock */}
        {site && (
          <div style={{
            background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Package size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ color: 'var(--text-2)' }}>Available stock:</span>
            <span style={{
              color: availableQty > 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {availableQty} {selectedMaterial?.unit || ''}
            </span>
          </div>
        )}

        {/* Quantity */}
        <div>
          <label className="lbl" style={{ marginBottom: 4, display: 'block' }}>
            Quantity *
          </label>
          <input className="inp" type="number" min="0.01" step="any" max={availableQty || undefined}
            value={quantity} onChange={e => setQuantity(e.target.value)} required
            placeholder={`Max: ${availableQty}`} style={{ height: 38, }} />
        </div>

        {/* Purpose + Work Area */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="lbl" style={{ marginBottom: 4, display: 'block' }}>
              Purpose
            </label>
            <input className="inp" value={purpose} onChange={e => setPurpose(e.target.value)}
              placeholder="e.g. Concrete pouring" style={{ height: 38, }} />
          </div>
          <div>
            <label className="lbl" style={{ marginBottom: 4, display: 'block' }}>
              Work Area
            </label>
            <input className="inp" value={workArea} onChange={e => setWorkArea(e.target.value)}
              placeholder="e.g. Block A 3rd Floor" style={{ height: 38, }} />
          </div>
        </div>

        {/* Consumed By */}
        <div>
          <label className="lbl" style={{ marginBottom: 4, display: 'block' }}>
            Consumed By *
          </label>
          <input className="inp" value={consumedBy} onChange={e => setConsumedBy(e.target.value)} required
            placeholder="Worker / Contractor name" style={{ height: 38, }} />
        </div>

        {/* Notes */}
        <div>
          <label className="lbl" style={{ marginBottom: 4, display: 'block' }}>
            Notes
          </label>
          <textarea className="inp" value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Additional remarks..." style={{ resize: 'vertical' }} />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--red-dim)', border: '1px solid var(--red)',
            borderRadius: 8, padding: '8px 12px', color: 'var(--red)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Submit */}
        <button type="submit" className="btn-primary" disabled={saving}
          style={{ height: 42, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving ? <><Loader2 size={16} className="spin" /> Logging...</> : <><Flame size={16} /> Log Consumption</>}
        </button>
      </form>
    </ModalShell>
  )
}

// ── Main Tab Component ─────────────────────────────────────────────────────────

export default function ConsumptionTab({ materials, stock, sites, onRefresh }) {
  const { user } = useAuth()

  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  // ── Fetch consumption records ───────────────────────────────────────────────

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('material_consumption')
        .select('*, materials(material_name, material_code, unit, unit_cost)')
        .order('created_at', { ascending: false })
      if (error) throw error

      if (data?.length) {
        const userIds = [...new Set(data.map(r => r.logged_by).filter(Boolean))]
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]))
        for (const r of data) {
          r.logger = { full_name: profileMap[r.logged_by] || null }
        }
      }
      setRecords(data || [])
    } catch (err) {
      console.error('Failed to fetch consumption records:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search) return records
    const q = search.toLowerCase()
    return records.filter(r =>
      r.materials?.material_name?.toLowerCase().includes(q) ||
      r.consumed_by?.toLowerCase().includes(q) ||
      r.purpose?.toLowerCase().includes(q) ||
      r.work_area?.toLowerCase().includes(q) ||
      r.consumption_no?.toLowerCase().includes(q) ||
      r.site?.toLowerCase().includes(q)
    )
  }, [records, search])

  // ── Summary stats ───────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const totalConsumed = records.length
    const thisMonth = records.filter(r => new Date(r.created_at) >= monthStart).length
    const totalCost = records.reduce((sum, r) => {
      const unitCost = r.materials?.unit_cost || 0
      return sum + (Number(r.quantity) * Number(unitCost))
    }, 0)
    const activeSites = new Set(records.map(r => r.site).filter(Boolean)).size

    return { totalConsumed, thisMonth, totalCost, activeSites }
  }, [records])

  const toggleOne = id => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAll = () => setSelectedIds(prev => prev.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(r => r.id)))
  const clearSel = () => setSelectedIds(new Set())

  async function handleBulkDelete(ids) {
    if (!confirm(`Delete ${ids.length} consumption record(s)?\n\nThey will be saved to Recycle Bin for recovery.`)) return
    try {
      const records = filtered.filter(r => ids.includes(r.id))
      trashSave('material_consumption', 'Consumption', records)
      const { error } = await supabase.from('material_consumption').delete().in('id', ids)
      if (error) throw error
      clearSel()
      fetchRecords()
    } catch (e) { alert(e.message) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Summary Stats */}
      <div className="mat-sub-stats">
        <div className="mat-sub-stat" data-accent="red">
          <div className="mat-sub-stat-icon"><Flame size={18} /></div>
          <div className="mat-sub-stat-val">{stats.totalConsumed}</div>
          <div className="mat-sub-stat-label">Total Consumed</div>
        </div>
        <div className="mat-sub-stat" data-accent="amber">
          <div className="mat-sub-stat-icon"><CalendarDays size={18} /></div>
          <div className="mat-sub-stat-val">{stats.thisMonth}</div>
          <div className="mat-sub-stat-label">This Month</div>
        </div>
        <div className="mat-sub-stat" data-accent="green">
          <div className="mat-sub-stat-icon"><IndianRupee size={18} /></div>
          <div className="mat-sub-stat-val">
            {stats.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="mat-sub-stat-label">Total Cost</div>
        </div>
        <div className="mat-sub-stat" data-accent="cyan">
          <div className="mat-sub-stat-icon"><Building2 size={18} /></div>
          <div className="mat-sub-stat-val">{stats.activeSites}</div>
          <div className="mat-sub-stat-label">Sites Active</div>
        </div>
      </div>

      {/* Top bar */}
      <div className="mat-subtab-bar">
        <div style={{ position: 'relative', flex: 1, minWidth: 150 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          <input className="inp" placeholder="Search consumption records..." style={{ paddingLeft: 34 }}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={14} /> <span className="btn-label">Log Consumption</span>
        </button>
      </div>

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'var(--red-dim)', borderBottom:'1px solid var(--status-danger-soft)' }}>
          <span style={{ color:'var(--red)', }}>{selectedIds.size} record{selectedIds.size > 1 ? 's' : ''} selected</span>
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

      {/* Loading */}
      {loading && (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
          <Loader2 size={24} className="spin" style={{ margin: '0 auto 12px' }} />
          <div >Loading consumption records...</div>
        </div>
      )}

      {/* Desktop Table */}
      {!loading && (
        <div className="card desktop-table" style={{ overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl" style={{ minWidth: 1050 }}>
              <thead>
                <tr>
                  <th style={{ width:36 }}><input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} style={{ cursor:'pointer' }}/></th>
                  <th>Date</th>
                  <th>Consumption No</th>
                  <th>Material</th>
                  <th>Site</th>
                  <th>Qty</th>
                  <th>Purpose</th>
                  <th>Work Area</th>
                  <th>Consumed By</th>
                  <th>Logged By</th>
                  <th style={{ textAlign:'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rec => (
                  <tr key={rec.id} style={{ background: selectedIds.has(rec.id) ? 'var(--status-danger-soft)' : undefined }}>
                    <td><input type="checkbox" checked={selectedIds.has(rec.id)} onChange={() => toggleOne(rec.id)} style={{ cursor:'pointer' }}/></td>
                    <td>
                      <span style={{ color: 'var(--text-2)', }}>
                        {new Date(rec.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--red)' }}>
                        {rec.consumption_no}
                      </span>
                    </td>
                    <td>
                      <div style={{ color: 'var(--text-0)', }}>
                        {rec.materials?.material_name || '-'}
                      </div>
                      <div style={{ color: 'var(--text-3)', }}>
                        {rec.materials?.material_code || ''}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {rec.site || '-'}
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-0)' }}>
                        {rec.quantity}
                      </span>
                      <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>
                        {rec.materials?.unit || ''}
                      </span>
                    </td>
                    <td style={{
                      color: 'var(--text-2)', maxWidth: 160,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {rec.purpose || '-'}
                    </td>
                    <td style={{
                      color: 'var(--text-2)', maxWidth: 160,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {rec.work_area || '-'}
                    </td>
                    <td style={{ color: 'var(--text-0)', }}>
                      {rec.consumed_by || '-'}
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {rec.logger?.full_name || '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => handleBulkDelete([rec.id])} title="Delete"
                        style={{ padding: '5px 7px', borderRadius: 8, background: 'var(--red-dim)',
                          border: '1.5px solid var(--status-danger-soft)', cursor: 'pointer', color: 'var(--red)' }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
                      {search ? 'No matching consumption records found.' : 'No consumption records yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile Cards */}
      {!loading && (
        <div className="mobile-cards" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(rec => (
            <div
              key={rec.id}
              style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14,
                padding: '14px 16px', borderLeft: '3px solid var(--red)',
              }}
            >
              {/* Row 1: Consumption No + Date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: 'var(--red)' }}>
                  {rec.consumption_no}
                </span>
                <span style={{ color: 'var(--text-3)' }}>
                  {new Date(rec.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
              </div>

              {/* Row 2: Material + Qty */}
              <div style={{ color: 'var(--text-0)', marginBottom: 4 }}>
                {rec.materials?.material_name || '-'}
                <span style={{ color: 'var(--red)', marginLeft: 8 }}>
                  {rec.quantity} {rec.materials?.unit || ''}
                </span>
              </div>

              {/* Row 3: Site + Consumed By */}
              <div style={{ display: 'flex', gap: 10, color: 'var(--text-3)', marginBottom: 4, flexWrap: 'wrap' }}>
                {rec.site && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <MapPin size={10} /> {rec.site}
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <User size={10} /> {rec.consumed_by || '-'}
                </span>
              </div>

              {/* Row 4: Purpose + Work Area */}
              <div style={{ display: 'flex', gap: 10, color: 'var(--text-2)', flexWrap: 'wrap' }}>
                {rec.purpose && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <FileText size={10} /> {rec.purpose}
                  </span>
                )}
                {rec.work_area && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Building2 size={10} /> {rec.work_area}
                  </span>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)', }}>
              <Flame size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              {search ? 'No matching consumption records found.' : 'No consumption records yet.'}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <LogConsumptionModal
          materials={materials}
          stock={stock}
          sites={sites}
          userId={user?.id}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false)
            fetchRecords()
            onRefresh()
          }}
        />
      )}
    </div>
  )
}
