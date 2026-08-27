import React, { useState, useMemo } from 'react'
import {
  Plus, Search, X, Loader2, Trash2, Check, XCircle, ChevronRight,
  ArrowUpRight, ArrowDownLeft, RotateCcw, Printer, Download, Truck,
  MapPin, Clock, User, FileText, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { createGatePass, updateGatePass, deleteGatePass, fetchGatePassItems } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import * as XLSX from 'xlsx'

const TYPE_CONFIG = {
  material_out: { label: 'Material Out', color: 'var(--red)', bg: 'var(--status-danger-soft)', icon: ArrowUpRight },
  material_in:  { label: 'Material In',  color: 'var(--green)', bg: 'rgba(34,197,94,0.08)', icon: ArrowDownLeft },
  returnable:   { label: 'Returnable',   color: 'var(--status-warning)', bg: 'var(--status-warning-soft)', icon: RotateCcw },
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'var(--status-warning)', bg: 'var(--status-warning-soft)' },
  approved:  { label: 'Approved',  color: 'var(--green)', bg: 'rgba(34,197,94,0.08)' },
  rejected:  { label: 'Rejected',  color: 'var(--red)', bg: 'var(--status-danger-soft)' },
  completed: { label: 'Completed', color: 'var(--accent)', bg: 'var(--accent-soft)' },
  cancelled: { label: 'Cancelled', color: 'var(--text-3)', bg: 'var(--bg-3)' },
}

// ── Main Tab Component ─────────────────────────────────────────────────────

export default function GatePassTab({ gatePasses, items, assets, sites = [], onRefresh }) {
  const { user, isAdmin, isMod, currentCompany } = useAuth()
  const cc = currentCompany?.code

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [detailItems, setDetailItems] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  const filtered = useMemo(() => gatePasses.filter(gp => {
    const matchSearch = !search ||
      gp.pass_no?.toLowerCase().includes(search.toLowerCase()) ||
      gp.carrier_name?.toLowerCase().includes(search.toLowerCase()) ||
      gp.vehicle_no?.toLowerCase().includes(search.toLowerCase()) ||
      gp.site?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || gp.status === filterStatus
    return matchSearch && matchStatus
  }), [gatePasses, search, filterStatus])

  const pendingCount = gatePasses.filter(g => g.status === 'pending').length

  async function openDetail(gp) {
    setShowDetail(gp)
    setDetailLoading(true)
    try { setDetailItems(await fetchGatePassItems(gp.id)) } catch (e) { console.error(e) }
    setDetailLoading(false)
  }

  // ── RENDER: List ──────────────────────────────────────────────────────────

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input className="inp" placeholder="Search passes…" style={{ paddingLeft: 32, height: 36, }}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', flexShrink: 0 }}>
          {['all', 'pending', 'approved', 'completed'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={filterStatus === s ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '5px 11px', textTransform: 'capitalize', whiteSpace: 'nowrap', borderRadius: 8,
                ...(s === 'pending' && filterStatus === s ? { background: 'var(--status-warning)', borderColor: 'var(--status-warning)' } : {}),
                ...(s === 'approved' && filterStatus === s ? { background: 'var(--green)', borderColor: 'var(--green)' } : {}),
              }}>
              {s}{s === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary" style={{ padding: '8px 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> New Pass
        </button>
      </div>

      {/* Desktop Table */}
      <div className="card desktop-table" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Pass No</th>
                <th>Type</th>
                <th>Site</th>
                <th>Carrier / Vehicle</th>
                <th>Purpose</th>
                <th>Requested</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(gp => {
                const tc = TYPE_CONFIG[gp.pass_type] || TYPE_CONFIG.material_out
                const sc = STATUS_CONFIG[gp.status] || STATUS_CONFIG.pending
                const TIcon = tc.icon
                return (
                  <tr key={gp.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(gp)}>
                    <td><span style={{ color: 'var(--accent)' }}>{gp.pass_no}</span></td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: tc.bg, color: tc.color, textTransform: 'uppercase' }}>
                        <TIcon size={11} /> {tc.label}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{gp.site || '-'}</td>
                    <td>
                      <div style={{ color: 'var(--text-0)', }}>{gp.carrier_name || '-'}</div>
                      {gp.vehicle_no && <div style={{ color: 'var(--text-3)', }}>{gp.vehicle_no}</div>}
                    </td>
                    <td style={{ color: 'var(--text-2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gp.purpose || '-'}</td>
                    <td>
                      <div style={{ color: 'var(--text-2)' }}>{gp.requester?.full_name || '-'}</div>
                      <div style={{ color: 'var(--text-3)', }}>{new Date(gp.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                    </td>
                    <td>
                      <span style={{ textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, color: sc.color, background: sc.bg, border: `1px solid ${sc.color}25` }}>{sc.label}</span>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        {gp.status === 'pending' && (isAdmin || isMod) && (
                          <button onClick={() => handleApprove(gp)} className="btn-ghost" style={{ padding: 6, color: 'var(--green)' }} title="Approve"><Check size={14} /></button>
                        )}
                        {gp.status === 'pending' && (
                          <button onClick={() => handleDelete(gp)} className="btn-ghost" style={{ padding: 6, color: 'var(--red)' }} title="Delete"><Trash2 size={14} /></button>
                        )}
                        <button onClick={() => openDetail(gp)} className="btn-ghost" style={{ padding: 6 }} title="View"><ChevronRight size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>No gate passes found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="mobile-cards" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filtered.map(gp => {
          const tc = TYPE_CONFIG[gp.pass_type] || TYPE_CONFIG.material_out
          const sc = STATUS_CONFIG[gp.status] || STATUS_CONFIG.pending
          const TIcon = tc.icon
          return (
            <div key={gp.id} onClick={() => openDetail(gp)} style={{
              background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14,
              padding: '14px 16px', borderLeft: `3px solid ${tc.color}`, cursor: 'pointer',
            }}>
              {/* Row 1: Pass No + Type + Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: 'var(--accent)' }}>{gp.pass_no}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 12, background: tc.bg, color: tc.color, textTransform: 'uppercase' }}>
                  <TIcon size={9} /> {tc.label}
                </span>
                <span style={{ marginLeft: 'auto', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, color: sc.color, background: sc.bg }}>{sc.label}</span>
              </div>
              {/* Row 2: Details */}
              <div style={{ display: 'flex', gap: 8, color: 'var(--text-3)', marginBottom: 4, flexWrap: 'wrap' }}>
                {gp.site && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} /> {gp.site}</span>}
                {gp.carrier_name && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Truck size={10} /> {gp.carrier_name}</span>}
                {gp.vehicle_no && <span >{gp.vehicle_no}</span>}
              </div>
              {gp.purpose && <div style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{gp.purpose}</div>}
              {/* Row 3: Meta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)' }}>
                <span>{gp.requester?.full_name || '-'}</span>
                <span >{new Date(gp.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)', }}>
            <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            No gate passes found.
          </div>
        )}
      </div>

      {/* ── Create Form Modal ── */}
      {showForm && (
        <GatePassFormModal
          items={items}
          assets={assets}
          sites={sites}
          user={user}
          cc={cc}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); onRefresh() }}
        />
      )}

      {/* ── Detail Modal ── */}
      {showDetail && (
        <GatePassDetailModal
          gp={showDetail}
          gpItems={detailItems}
          loading={detailLoading}
          user={user}
          isAdmin={isAdmin}
          isMod={isMod}
          cc={cc}
          onClose={() => { setShowDetail(null); setDetailItems([]) }}
          onRefresh={() => { onRefresh(); setShowDetail(null) }}
        />
      )}
    </div>
  )

  async function handleApprove(gp) {
    if (!window.confirm(`Approve gate pass ${gp.pass_no}?`)) return
    try {
      await updateGatePass(gp.id, { status: 'approved', approved_by: user.id }, user.id, cc)
      onRefresh()
    } catch (e) { alert(e.message) }
  }

  async function handleDelete(gp) {
    if (!window.confirm(`Delete gate pass ${gp.pass_no}?`)) return
    try { await deleteGatePass(gp.id); onRefresh() } catch (e) { alert(e.message) }
  }
}

// ── Gate Pass Form Modal ────────────────────────────────────────────────────

function GatePassFormModal({ items, assets, sites = [], user, cc, onClose, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    pass_type: 'material_out', site: '', gate_name: '', purpose: '',
    destination: '', source: '', carrier_name: '', carrier_company: '',
    vehicle_no: '', carrier_phone: '', expected_at: '', remarks: '',
  })
  const [lineItems, setLineItems] = useState([{ description: '', quantity: 1, unit: 'pcs', inventory_item_id: null, asset_id: null, serial_numbers: '' }])

  function addLine() { setLineItems(p => [...p, { description: '', quantity: 1, unit: 'pcs', inventory_item_id: null, asset_id: null, serial_numbers: '' }]) }
  function removeLine(i) { setLineItems(p => p.filter((_, idx) => idx !== i)) }
  function updateLine(i, field, val) { setLineItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it)) }

  function pickItem(i, val) {
    if (!val) {
      // Custom - clear links
      setLineItems(p => p.map((it, idx) => idx === i ? { ...it, inventory_item_id: null, asset_id: null } : it))
      return
    }
    if (val.startsWith('inv:')) {
      const itemId = val.slice(4)
      const item = items.find(x => x.id === itemId)
      setLineItems(p => p.map((it, idx) => idx === i ? { ...it, description: item?.material_name || item?.item_name || it.description, inventory_item_id: itemId, asset_id: null, unit: item?.unit || it.unit } : it))
    } else if (val.startsWith('asset:')) {
      const assetId = val.slice(6)
      const asset = assets.find(x => x.id === assetId)
      setLineItems(p => p.map((it, idx) => idx === i ? { ...it, description: asset ? `${asset.asset_name} (${asset.asset_code})` : it.description, asset_id: assetId, inventory_item_id: null, unit: 'nos', quantity: 1 } : it))
    }
  }

  async function handleSubmit() {
    if (!form.pass_type || lineItems.every(l => !l.description.trim())) return alert('Add at least one item')
    setSaving(true)
    try {
      const passItems = lineItems.filter(l => l.description.trim()).map(({ description, quantity, unit, inventory_item_id, asset_id, serial_numbers }) => ({
        description, quantity: Number(quantity) || 1, unit, inventory_item_id: inventory_item_id || null, asset_id: asset_id || null, serial_numbers,
      }))
      await createGatePass(form, passItems, user.id, cc)
      onSaved()
    } catch (e) { alert('Error: ' + e.message) }
    setSaving(false)
  }

  const isOut = form.pass_type === 'material_out' || form.pass_type === 'returnable'

  return (
    <div className="modal-bg" style={{ zIndex: 2000 }} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '92vh', overflow: 'auto', padding: 0 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-2)', zIndex: 1 }}>
          <h2 style={{ margin: 0, letterSpacing: '0.05em', color: 'var(--text-0)' }}>NEW GATE PASS</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Pass Type */}
          <div>
            <label className="lbl">Pass Type *</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon
                return (
                  <button key={key} onClick={() => setForm(f => ({ ...f, pass_type: key }))}
                    style={{
                      flex: 1, padding: '8px 6px', borderRadius: 10, border: `1.5px solid ${form.pass_type === key ? cfg.color : 'var(--border)'}`,
                      background: form.pass_type === key ? cfg.bg : 'var(--bg-3)', color: form.pass_type === key ? cfg.color : 'var(--text-3)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, textTransform: 'uppercase',
                    }}>
                    <Icon size={13} /> {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Site + Gate */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="lbl">Site</label>
              <select className="sel" value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))}>
                <option value="">Select site...</option>
                {sites.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="lbl">Gate</label><input className="inp" value={form.gate_name} onChange={e => setForm(f => ({ ...f, gate_name: e.target.value }))} placeholder="e.g. Main Gate" /></div>
          </div>

          {/* Purpose */}
          <div><label className="lbl">Purpose</label><input className="inp" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder="Reason for material movement" /></div>

          {/* Destination / Source */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="lbl">{isOut ? 'Destination' : 'Source'}</label>
              <select className="sel" value={isOut ? form.destination : form.source} onChange={e => setForm(f => ({ ...f, [isOut ? 'destination' : 'source']: e.target.value }))}>
                <option value="">{isOut ? 'Select destination...' : 'Select source...'}</option>
                {sites.filter(s => s !== form.site).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="lbl">Expected Date</label><input className="inp" type="datetime-local" value={form.expected_at} onChange={e => setForm(f => ({ ...f, expected_at: e.target.value }))} /></div>
          </div>

          {/* Carrier Info */}
          <div style={{ background: 'var(--bg-1)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
            <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.05em' }}>Carrier / Vehicle</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input className="inp" value={form.carrier_name} onChange={e => setForm(f => ({ ...f, carrier_name: e.target.value }))} placeholder="Driver Name"  />
              <input className="inp" value={form.carrier_company} onChange={e => setForm(f => ({ ...f, carrier_company: e.target.value }))} placeholder="Transporter"  />
              <input className="inp" value={form.vehicle_no} onChange={e => setForm(f => ({ ...f, vehicle_no: e.target.value }))} placeholder="Vehicle No"  />
              <input className="inp" value={form.carrier_phone} onChange={e => setForm(f => ({ ...f, carrier_phone: e.target.value }))} placeholder="Phone"  />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label className="lbl" style={{ margin: 0 }}>Items *</label>
              <button onClick={addLine} className="btn-ghost" style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12} /> Add</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lineItems.map((li, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                  <div style={{ flex: 2 }}>
                    {i === 0 && <label style={{ color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Item / Description</label>}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <select className="sel" style={{ width: 140, flexShrink: 0 }}
                        value={li.inventory_item_id ? `inv:${li.inventory_item_id}` : li.asset_id ? `asset:${li.asset_id}` : ''}
                        onChange={e => pickItem(i, e.target.value)}>
                        <option value="">Custom</option>
                        {(items || []).length > 0 && <optgroup label="Materials">
                          {items.map(it => <option key={it.id} value={`inv:${it.id}`}>{it.material_code ? `${it.material_code} - ` : ''}{it.material_name || it.item_name || ''}</option>)}
                        </optgroup>}
                        {(assets || []).length > 0 && <optgroup label="Assets">
                          {assets.map(a => <option key={a.id} value={`asset:${a.id}`}>{a.asset_name} - {a.asset_code}</option>)}
                        </optgroup>}
                      </select>
                      <input className="inp" value={li.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Description" style={{ flex: 1 }} />
                    </div>
                  </div>
                  <div style={{ width: 60 }}>
                    {i === 0 && <label style={{ color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Qty</label>}
                    <input className="inp" type="number" min="1" value={li.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} style={{ textAlign: 'center' }} />
                  </div>
                  <div style={{ width: 60 }}>
                    {i === 0 && <label style={{ color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Unit</label>}
                    <input className="inp" value={li.unit} onChange={e => updateLine(i, 'unit', e.target.value)}  />
                  </div>
                  {lineItems.length > 1 && (
                    <button onClick={() => removeLine(i)} className="btn-ghost" style={{ padding: 6, color: 'var(--red)', flexShrink: 0 }}><Trash2 size={13} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Remarks */}
          <div><label className="lbl">Remarks</label><textarea className="inp" rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Additional notes…" style={{ resize: 'vertical', }} /></div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button onClick={handleSubmit} disabled={saving} className="btn-primary" style={{ gap: 6 }}>
              {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
              Create Gate Pass
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Gate Pass Detail Modal ──────────────────────────────────────────────────

function GatePassDetailModal({ gp, gpItems, loading, user, isAdmin, isMod, cc, onClose, onRefresh }) {
  const [actionLoading, setActionLoading] = useState(null)
  const [approvalNotes, setApprovalNotes] = useState('')

  const tc = TYPE_CONFIG[gp.pass_type] || TYPE_CONFIG.material_out
  const sc = STATUS_CONFIG[gp.status] || STATUS_CONFIG.pending
  const TIcon = tc.icon

  async function handleAction(action) {
    setActionLoading(action)
    try {
      const updates = { status: action }
      if (action === 'approved') updates.approved_by = user.id
      if (action === 'completed') updates.completed_at = new Date().toISOString()
      if (approvalNotes) updates.approval_notes = approvalNotes
      await updateGatePass(gp.id, updates, user.id, cc)
      onRefresh()
    } catch (e) { alert(e.message) }
    setActionLoading(null)
  }

  function printGatePass() {
    const itemsHtml = gpItems.map((it, i) => `<tr><td>${i + 1}</td><td>${it.description}</td><td style="text-align:center">${it.quantity}</td><td>${it.unit}</td><td>${it.serial_numbers || '-'}</td></tr>`).join('')
    const html = `<!DOCTYPE html><html><head><title>Gate Pass - ${gp.pass_no}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}body{padding:30px;color:#1a1a2e;max-width:800px;margin:0 auto}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #4f7eff;padding-bottom:16px;margin-bottom:20px}
      .pass-no{font-size:1.8rem;font-weight:800;color:#4f7eff;letter-spacing:0.05em}
      .badge{display:inline-block;padding:4px 12px;border-radius:4px;font-size:0.75rem;font-weight:700;text-transform:uppercase}
      .section{margin-bottom:16px;padding:14px 18px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb}
      .section-title{font-size:0.72rem;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;font-weight:700;margin-bottom:8px}
      .row{display:flex;gap:20px;margin-bottom:6px;font-size:0.88rem}.row .label{color:#6b7280;min-width:100px}.row .value{color:#1a1a2e;font-weight:600}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th{background:#4f7eff;color:white;padding:8px 12px;text-align:left;font-size:0.72rem;text-transform:uppercase;font-weight:700}
      td{padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:0.85rem}
      tr:nth-child(even){background:#f8fafc}
      .sig-row{display:flex;gap:24px;margin-top:30px}.sig-box{flex:1;text-align:center;padding-top:60px;border-top:1px solid #1a1a2e}
      .sig-label{font-size:0.72rem;color:#6b7280;text-transform:uppercase;margin-top:4px}
      .footer{margin-top:30px;text-align:center;font-size:0.7rem;color:#999;border-top:1px solid #e5e7eb;padding-top:12px}
      @media print{body{padding:15px}.section{page-break-inside:avoid}}
    </style></head><body>
    <div class="header">
      <div>
        <div style="font-size:1.1rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em">Gate Pass</div>
        <div class="pass-no">${gp.pass_no}</div>
      </div>
      <div style="text-align:right">
        <div class="badge" style="background:${tc.bg};color:${tc.color};border:1px solid ${tc.color}">${tc.label}</div>
        <div style="margin-top:6px;font-size:0.82rem;color:#6b7280">${new Date(gp.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">General Information</div>
      <div class="row"><span class="label">Site:</span><span class="value">${gp.site || '-'}</span></div>
      <div class="row"><span class="label">Gate:</span><span class="value">${gp.gate_name || '-'}</span></div>
      <div class="row"><span class="label">Purpose:</span><span class="value">${gp.purpose || '-'}</span></div>
      <div class="row"><span class="label">${gp.pass_type === 'material_in' ? 'Source' : 'Destination'}:</span><span class="value">${gp.destination || gp.source || '-'}</span></div>
      ${gp.expected_at ? `<div class="row"><span class="label">Expected:</span><span class="value">${new Date(gp.expected_at).toLocaleString()}</span></div>` : ''}
    </div>
    <div class="section">
      <div class="section-title">Carrier / Vehicle</div>
      <div class="row"><span class="label">Name:</span><span class="value">${gp.carrier_name || '-'}</span></div>
      <div class="row"><span class="label">Company:</span><span class="value">${gp.carrier_company || '-'}</span></div>
      <div class="row"><span class="label">Vehicle:</span><span class="value">${gp.vehicle_no || '-'}</span></div>
      <div class="row"><span class="label">Phone:</span><span class="value">${gp.carrier_phone || '-'}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Materials</div>
      <table><thead><tr><th>#</th><th>Description</th><th style="text-align:center">Qty</th><th>Unit</th><th>Serial Nos</th></tr></thead>
      <tbody>${itemsHtml}</tbody></table>
    </div>
    ${gp.remarks ? `<div class="section"><div class="section-title">Remarks</div><p style="font-size:0.88rem">${gp.remarks}</p></div>` : ''}
    <div class="sig-row">
      <div class="sig-box"><div class="sig-label">Requested By</div><div style="font-size:0.82rem;margin-top:4px">${gp.requester?.full_name || '-'}</div></div>
      <div class="sig-box"><div class="sig-label">Approved By</div><div style="font-size:0.82rem;margin-top:4px">${gp.approver?.full_name || '-'}</div></div>
      <div class="sig-box"><div class="sig-label">Gate Security</div></div>
    </div>
    <div class="footer">Gate Pass ${gp.pass_no} · Generated on ${new Date().toLocaleString()} · Strongbuilt</div>
    </body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }

  function downloadExcel() {
    const rows = gpItems.map((it, i) => ({ '#': i + 1, 'Description': it.description, 'Quantity': it.quantity, 'Unit': it.unit, 'Serial Numbers': it.serial_numbers || '' }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Gate Pass Items')
    XLSX.writeFile(wb, `${gp.pass_no}_Items.xlsx`)
  }

  return (
    <div className="modal-bg" style={{ zIndex: 2000 }} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '92vh', overflow: 'auto', padding: 0 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-2)', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tc.color }}><TIcon size={16} /></div>
            <div>
              <div style={{ color: 'var(--accent)' }}>{gp.pass_no}</div>
              <div style={{ color: 'var(--text-3)' }}>{tc.label}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4, color: sc.color, background: sc.bg }}>{sc.label}</span>
            <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 16 }}>
            {[
              { l: 'Site', v: gp.site },
              { l: 'Gate', v: gp.gate_name },
              { l: 'Purpose', v: gp.purpose, full: true },
              { l: gp.pass_type === 'material_in' ? 'Source' : 'Destination', v: gp.destination || gp.source },
              { l: 'Expected', v: gp.expected_at ? new Date(gp.expected_at).toLocaleString() : null },
              { l: 'Requested By', v: gp.requester?.full_name },
              { l: 'Date', v: new Date(gp.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
            ].filter(x => x.v).map(x => (
              <div key={x.l} style={x.full ? { gridColumn: '1 / -1' } : {}}>
                <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 2 }}>{x.l}</div>
                <div style={{ color: 'var(--text-0)', }}>{x.v}</div>
              </div>
            ))}
          </div>

          {/* Carrier */}
          {(gp.carrier_name || gp.vehicle_no) && (
            <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6, letterSpacing: '0.05em' }}>Carrier / Vehicle</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: 'var(--text-0)' }}>
                {gp.carrier_name && <span><strong>Name:</strong> {gp.carrier_name}</span>}
                {gp.carrier_company && <span><strong>Company:</strong> {gp.carrier_company}</span>}
                {gp.vehicle_no && <span><strong>Vehicle:</strong> <span >{gp.vehicle_no}</span></span>}
                {gp.carrier_phone && <span><strong>Phone:</strong> {gp.carrier_phone}</span>}
              </div>
            </div>
          )}

          {/* Items Table */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.05em' }}>Materials ({gpItems.length})</div>
            {loading ? (
              <div style={{ padding: 30, textAlign: 'center' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} /></div>
            ) : gpItems.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', }}>No items</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {gpItems.map((it, i) => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 8 }}>
                    <span style={{ color: 'var(--text-3)', width: 20 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</div>
                      {it.serial_numbers && <div style={{ color: 'var(--text-3)', }}>{it.serial_numbers}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ color: 'var(--text-0)' }}>{it.quantity}</span>
                      <span style={{ color: 'var(--text-3)', marginLeft: 3 }}>{it.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Remarks */}
          {gp.remarks && (
            <div style={{ padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 8, marginBottom: 16, color: 'var(--text-2)' }}>
              <strong>Remarks:</strong> {gp.remarks}
            </div>
          )}
          {gp.approval_notes && (
            <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.05)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.2)', marginBottom: 16, color: 'var(--text-2)' }}>
              <strong>Approval Notes:</strong> {gp.approval_notes}
            </div>
          )}

          {/* Approval notes input for pending passes */}
          {gp.status === 'pending' && (isAdmin || isMod) && (
            <div style={{ marginBottom: 16 }}>
              <label className="lbl">Approval Notes</label>
              <input className="inp" value={approvalNotes} onChange={e => setApprovalNotes(e.target.value)} placeholder="Optional notes…" />
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
            <button onClick={printGatePass} className="btn-ghost" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 5 }}><Printer size={14} /> Print</button>
            <button onClick={downloadExcel} className="btn-ghost" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 5 }}><Download size={14} /> Excel</button>

            <div style={{ flex: 1 }} />

            {gp.status === 'pending' && (isAdmin || isMod) && (
              <>
                <button onClick={() => handleAction('rejected')} disabled={actionLoading} className="btn-ghost" style={{ padding: '8px 14px', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {actionLoading === 'rejected' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={14} />} Reject
                </button>
                <button onClick={() => handleAction('approved')} disabled={actionLoading} className="btn-primary" style={{ padding: '8px 16px', background: 'var(--green)', borderColor: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {actionLoading === 'approved' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />} Approve
                </button>
              </>
            )}
            {gp.status === 'approved' && (isAdmin || isMod) && (
              <button onClick={() => handleAction('completed')} disabled={actionLoading} className="btn-primary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 5 }}>
                {actionLoading === 'completed' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />} Mark Completed
              </button>
            )}
            {gp.status === 'pending' && gp.requested_by === user.id && (
              <button onClick={() => handleAction('cancelled')} disabled={actionLoading} className="btn-ghost" style={{ padding: '8px 14px', color: 'var(--red)' }}>Cancel</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


