import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Plus, Search, X, Loader2, ArrowLeftRight,
  CheckCircle2, XCircle, Clock, Eye, Package,
  MapPin, User, Truck, Printer,
  ArrowUpRight, ArrowDownLeft, RotateCcw, Trash2, Upload,
} from 'lucide-react'
import { supabase, notifyUsersAtSite, bulkTransferAsset } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ModalShell from '../materials/ModalShell'
import { fmtDate, fmtDateTime, generateDocNo } from '../materials/helpers'
import companyLogo from '../../assets/logo.png'

// ── Config ───────────────────────────────────────────────────────────────────

const PASS_TYPE_CONFIG = {
  asset_out:   { label: 'Asset Out',   color: 'var(--red)',   bg: 'var(--status-danger-soft)', icon: ArrowUpRight },
  asset_in:    { label: 'Asset In',    color: 'var(--green)', bg: 'rgba(34,197,94,0.08)', icon: ArrowDownLeft },
  returnable:  { label: 'Returnable',  color: 'var(--status-warning)',      bg: 'var(--status-warning-soft)', icon: RotateCcw },
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'var(--amber)', bg: 'var(--amber-dim)', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'var(--green)', bg: 'var(--green-dim)', icon: CheckCircle2 },
  rejected:  { label: 'Rejected',  color: 'var(--red)',   bg: 'var(--red-dim)',   icon: XCircle },
}

// ── Badges ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return <span className="badge">{status}</span>
  const Icon = cfg.icon
  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon size={12} />{cfg.label}
    </span>
  )
}

function PassTypeBadge({ type }) {
  const cfg = PASS_TYPE_CONFIG[type]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon size={12} />{cfg.label}
    </span>
  )
}

// ── Print Gate Pass ──────────────────────────────────────────────────────────

function printGatePass(transfer, transferItems) {
  const t = transfer
  const initiator = t.initiator || {}
  const confirmer = t.confirmer || {}
  const items = transferItems || []

  const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
  const passTypeLabel = PASS_TYPE_CONFIG[t.pass_type]?.label || 'Asset Out'

  const itemRows = items.length > 0
    ? items.map((item, idx) => `
      <tr>
        <td class="sr-col">${idx + 1}</td>
        <td>${item.description || ''}${item.assets?.asset_code ? ' (' + item.assets.asset_code + ')' : ''}</td>
        <td class="unit-col">${item.unit || 'nos'}</td>
        <td class="qty-col" style="font-weight:bold;">${item.quantity || 1}</td>
        <td>${item.remarks || ''}</td>
      </tr>`).join('')
    : `<tr><td class="sr-col">1</td><td>-</td><td class="unit-col">nos</td><td class="qty-col">1</td><td></td></tr>`

  const filledCount = items.length > 0 ? items.length : 1
  const emptyRows = Math.max(0, 11 - filledCount)
  const emptyRowsHtml = Array.from({ length: emptyRows }, () =>
    `<tr class="empty-row"><td class="sr-col"></td><td></td><td class="unit-col"></td><td class="qty-col"></td><td></td></tr>`).join('')

  const html = `<!DOCTYPE html><html><head><title>Gate Pass - ${t.gate_pass_no || t.transfer_no}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-size: 13px; color: #000; background: #fff; }
  .gate-pass { max-width: 780px; margin: 0 auto; border: 2px solid #000; }
  .header { text-align: center; padding: 16px 20px 12px; border-bottom: 2px solid #000; }
  .company-name { font-size: 22px; font-weight: bold; letter-spacing: 1px; margin-bottom: 6px; }
  .gate-pass-title { font-size: 16px; font-weight: bold; text-decoration: underline; letter-spacing: 2px; margin-bottom: 8px; }
  .gp-no { font-size: 15px; font-weight: bold; }
  .pass-type-label { display: inline-block; padding: 2px 12px; border-radius: 3px; font-size: 12px; font-weight: bold; text-transform: uppercase; margin-left: 12px; border: 1.5px solid #333; }
  .info-row { display: flex; border-bottom: 1.5px solid #000; }
  .info-cell { padding: 8px 12px; border-right: 1.5px solid #000; flex: 1; }
  .info-cell:last-child { border-right: none; }
  .info-label { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #333; margin-bottom: 2px; }
  .info-value { font-size: 13px; font-weight: 600; min-height: 18px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 7px 10px; text-align: left; font-size: 12px; }
  th { background: #f5f5f5; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
  .sr-col { width: 50px; text-align: center; }
  .unit-col { width: 80px; text-align: center; }
  .qty-col { width: 80px; text-align: center; }
  .empty-row td { height: 28px; }
  .signature-section { display: flex; border-top: 1.5px solid #000; }
  .signature-block { flex: 1; padding: 12px 16px; min-height: 70px; border-right: 1px solid #000; display: flex; flex-direction: column; justify-content: space-between; }
  .signature-block:last-child { border-right: none; }
  .signature-label { font-size: 11px; font-weight: bold; text-align: center; color: #333; }
  .signature-line { border-bottom: 1px solid #999; margin-top: auto; margin-bottom: 4px; height: 30px; }
  @media print { body { -webkit-print-color-adjust: exact; } .no-print { display: none !important; } }
</style></head><body>
  <div style="text-align:center; margin: 10px 0 16px;" class="no-print">
    <button onclick="window.print()" style="padding:10px 28px; font-size:15px; font-weight:bold; cursor:pointer; background:var(--accent); color:white; border:none; border-radius:6px;">Print / Download PDF</button>
  </div>
  <div class="gate-pass">
    <div class="header" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px;">
      <div>
        <img src="${companyLogo}" alt="Company Logo" style="height: 80px; object-fit: contain;" />
      </div>
      <div style="text-align: right;">
        <div class="company-name" style="margin-bottom: 2px; text-align: right;">Strongbuilt Constructions Pvt. Ltd.</div>
        <div class="gate-pass-title" style="margin-bottom: 4px; text-align: right;">GATE PASS - ASSET TRANSFER</div>
        <div class="gp-no" style="text-align: right;">${t.gate_pass_no || t.transfer_no}</div>
      </div>
    </div>
    <div class="info-row">
      <div class="info-cell"><div class="info-label">Date</div><div class="info-value">${dateStr}</div></div>
      <div class="info-cell"><div class="info-label">Transfer No</div><div class="info-value">${t.transfer_no}</div></div>
      <div class="info-cell"><div class="info-label">Status</div><div class="info-value">${(t.status || '').toUpperCase()}</div></div>
    </div>
    <div class="info-row">
      <div class="info-cell"><div class="info-label">From Site</div><div class="info-value">${t.from_site || ''}</div></div>
      <div class="info-cell"><div class="info-label">To Site</div><div class="info-value">${t.to_site || ''}</div></div>
    </div>
    <div class="info-row">
      <div class="info-cell"><div class="info-label">Vehicle No</div><div class="info-value">${t.vehicle_no || ''}</div></div>
      <div class="info-cell"><div class="info-label">Driver</div><div class="info-value">${t.carrier_name || ''}</div></div>
      <div class="info-cell"><div class="info-label">Transporter</div><div class="info-value">${t.carrier_company || ''}</div></div>
    </div>
    ${t.purpose ? `<div class="info-row"><div class="info-cell" style="border-right:none"><div class="info-label">Purpose</div><div class="info-value">${t.purpose}</div></div></div>` : ''}
    <table><thead><tr><th class="sr-col">Sr.</th><th>Description / Asset</th><th class="unit-col">Unit</th><th class="qty-col">Qty</th><th>Remarks</th></tr></thead>
    <tbody>${itemRows}${emptyRowsHtml}</tbody></table>
    <div class="info-row">
      <div class="info-cell"><div class="info-label">Initiated By</div><div class="info-value">${initiator.full_name || ''}</div></div>
      <div class="info-cell"><div class="info-label">Confirmed By</div><div class="info-value">${confirmer.full_name || ''}</div></div>
    </div>
    <div class="signature-section">
      <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Sender Signature</div></div>
      <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Security / Gate</div></div>
      <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Receiver Signature</div></div>
    </div>
  </div>
  <div style="text-align:center; margin-top:12px; font-size:11px; color:#999;" class="no-print">Generated digitally from AssetPro - ${new Date().toLocaleString('en-IN')}</div>
</body></html>`

  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}

// ── Create Transfer Modal ────────────────────────────────────────────────────

function CreateTransferModal({ onClose, assets, sites, onSubmit }) {
  const [form, setForm] = useState({
    pass_type: 'asset_out',
    from_site: '',
    to_site: '',
    purpose: '',
    vehicle_no: '',
    carrier_name: '',
    carrier_company: '',
    carrier_phone: '',
    ref_mtv_no: '',
    notes: '',
  })
  const [lineItems, setLineItems] = useState([
    { asset_id: '', description: '', quantity: 1, unit: 'nos', remarks: '' }
  ])
  const [saving, setSaving] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [siteAssets, setSiteAssets] = useState([])
  const fileRef = useRef(null)

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  // Fetch all assets at the selected from_site directly from DB
  useEffect(() => {
    if (!form.from_site) { setSiteAssets([]); return }
    supabase.from('assets')
      .select('id, asset_code, asset_name, category, site, quantity, asset_type')
      .or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
      .eq('site', form.from_site).order('asset_name')
      .then(({ data }) => setSiteAssets(data || []))
  }, [form.from_site])

  // Asset picker helpers
  function addLine() {
    setLineItems(p => [...p, { asset_id: '', description: '', quantity: 1, remarks: '' }])
  }
  function removeLine(i) {
    setLineItems(p => p.filter((_, idx) => idx !== i))
  }
  function updateLine(i, field, val) {
    setLineItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  }
  function pickAsset(i, assetId) {
    const a = siteAssets.find(x => x.id === assetId)
    if (a) {
      const isBulk = a.asset_type === 'bulk' || (Number(a.quantity) > 1)
      setLineItems(p => p.map((it, idx) => idx === i ? {
        ...it, asset_id: assetId,
        description: `${a.asset_name}${a.asset_code ? ' (' + a.asset_code + ')' : ''}`,
        quantity: isBulk ? '' : 1,
        _isBulk: isBulk,
        _availableQty: Number(a.quantity) || 1,
      } : it))
      if (a.site && !form.from_site) set('from_site', a.site)
    } else {
      setLineItems(p => p.map((it, idx) => idx === i ? { ...it, asset_id: '', description: '', _isBulk: false, _availableQty: 0 } : it))
    }
  }

  const toSiteOptions = useMemo(() => sites.filter(s => s !== form.from_site), [sites, form.from_site])

  const hasValidItem = lineItems.some(li => li.description.trim())
  const hasQtyError = lineItems.some(li => li._isBulk && (Number(li.quantity) > li._availableQty || Number(li.quantity) <= 0))
  const valid = form.from_site && form.to_site && form.from_site !== form.to_site && hasValidItem && !hasQtyError

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    try {
      await onSubmit(form, lineItems.filter(li => li.description.trim()), uploadedFile)
      onClose()
    } catch (err) {
      console.error('Transfer create error:', err)
      alert('Failed to create: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  const passTypeCfg = PASS_TYPE_CONFIG[form.pass_type]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(26,34,64,0.35)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div className="card" onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 680, maxHeight: '95vh', overflow: 'auto', WebkitOverflowScrolling: 'touch',
          borderRadius: '20px 20px 0 0', padding: 0, animation: 'fadeUp 0.25s ease-out',
          borderTop: `3px solid ${passTypeCfg?.color || 'var(--accent)'}` }}>

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-2)',
          padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ textTransform: 'uppercase', letterSpacing: 0.5,
            color: 'var(--text-0)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={16} style={{ color: passTypeCfg?.color || 'var(--accent)' }} />
            New Asset Transfer / Gate Pass
          </h3>
          <button onClick={onClose} style={{ background: 'var(--bg-3)', border: '1.5px solid var(--border)',
            borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-3)', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Pass Type */}
          <div>
            <label className="lbl">Pass Type *</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {Object.entries(PASS_TYPE_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon
                const active = form.pass_type === key
                return (
                  <button type="button" key={key} onClick={() => set('pass_type', key)}
                    style={{ flex: 1, padding: '10px 4px', borderRadius: 10,
                      border: `1.5px solid ${active ? cfg.color : 'var(--border)'}`,
                      background: active ? cfg.bg : 'var(--bg-3)',
                      color: active ? cfg.color : 'var(--text-3)',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textTransform: 'uppercase',
                      transition: 'all 0.15s' }}>
                    <Icon size={16} />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* From / To Sites */}
          <div>
            <label className="lbl">From Site (Sender) *</label>
            <select className="sel" value={form.from_site} onChange={e => set('from_site', e.target.value)} style={{ marginBottom: 10 }}>
              <option value="">Select site...</option>
              {sites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="lbl">To Site (Receiver) *</label>
            <select className="sel" value={form.to_site} onChange={e => set('to_site', e.target.value)}>
              <option value="">Select site...</option>
              {toSiteOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Purpose */}
          <div>
            <label className="lbl">Purpose</label>
            <input className="inp" placeholder="Reason for asset movement" value={form.purpose} onChange={e => set('purpose', e.target.value)} />
          </div>

          {/* Carrier / Vehicle */}
          <div style={{ background: 'var(--bg-1)', borderRadius: 12, padding: '14px 14px', border: '1px solid var(--border)' }}>
            <div style={{ textTransform: 'uppercase',
              color: 'var(--text-3)', marginBottom: 10, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Truck size={13} /> Carrier / Vehicle
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="inp" value={form.carrier_name} onChange={e => set('carrier_name', e.target.value)} placeholder="Driver Name"  />
                <input className="inp" value={form.carrier_company} onChange={e => set('carrier_company', e.target.value)} placeholder="Transporter"  />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="inp" value={form.vehicle_no} onChange={e => set('vehicle_no', e.target.value)} placeholder="Vehicle No."  />
                <input className="inp" value={form.carrier_phone} onChange={e => set('carrier_phone', e.target.value)} placeholder="Phone"  />
              </div>
              <input className="inp" value={form.ref_mtv_no} onChange={e => set('ref_mtv_no', e.target.value)} placeholder="Ref. MTV No."  />
            </div>
          </div>

          {/* Assets / Line Items */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label className="lbl" style={{ margin: 0 }}>Assets / Items *</label>
              <button type="button" onClick={addLine} className="btn-ghost" style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8 }}>
                <Plus size={13} /> Add
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lineItems.map((li, i) => (
                <div key={`skel2-${i}`} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 12px', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em' }}>
                      Item {i + 1}
                    </span>
                    {lineItems.length > 1 && (
                      <button type="button" onClick={() => removeLine(i)} className="btn-ghost"
                        style={{ padding: '2px 6px', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Trash2 size={11} /> Remove
                      </button>
                    )}
                  </div>

                  {/* Asset select */}
                  <select className="sel" style={{ width: '100%', marginBottom: 8 }}
                    value={li.asset_id || ''} onChange={e => pickAsset(i, e.target.value)}
                    disabled={!form.from_site}>
                    <option value="">{!form.from_site ? 'Select a From Site first...' : siteAssets.length === 0 ? 'No assets at this site' : 'Select asset or type custom...'}</option>
                    {siteAssets.map(a => {
                      const isBulkAsset = a.asset_type === 'bulk' || (Number(a.quantity) > 1)
                      return (
                        <option key={a.id} value={a.id}>
                          {a.asset_code ? `${a.asset_code} - ` : ''}{a.asset_name}{a.category ? ` [${a.category}]` : ''}{isBulkAsset ? ` (${a.quantity} units)` : ''}
                        </option>
                      )
                    })}
                  </select>

                  {/* Description */}
                  <input className="inp" value={li.description} onChange={e => updateLine(i, 'description', e.target.value)}
                    placeholder="Description" style={{ width: '100%', marginBottom: 8 }} />

                  {/* Bulk asset info */}
                  {li._isBulk && li._availableQty > 0 && (
                    <div style={{ color: 'var(--accent)', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 6, padding: '5px 10px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Package size={12} /> Bulk Asset - Available: <strong>{li._availableQty} units</strong>. Enter qty to transfer.
                    </div>
                  )}

                  {/* Qty + Unit + Remarks */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 6 }}>
                    <div>
                      <label style={{ color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Qty {li._isBulk ? `(max ${li._availableQty})` : ''}</label>
                      <input className="inp" type="number" min="1" max={li._isBulk ? li._availableQty : undefined} step="1" value={li.quantity}
                        onChange={e => updateLine(i, 'quantity', e.target.value)}
                        placeholder={li._isBulk ? `Max ${li._availableQty}` : '1'}
                        style={{ textAlign: 'center', borderColor: li._isBulk && Number(li.quantity) > li._availableQty ? 'var(--red)' : undefined }} />
                      {li._isBulk && Number(li.quantity) > li._availableQty && (
                        <p style={{ color: 'var(--red)', marginTop: 2 }}>Exceeds available qty</p>
                      )}
                    </div>
                    <div>
                      <label style={{ color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Unit</label>
                      <input className="inp" value={li.unit} onChange={e => updateLine(i, 'unit', e.target.value)}  />
                    </div>
                    <div>
                      <label style={{ color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Remarks</label>
                      <input className="inp" value={li.remarks || ''} onChange={e => updateLine(i, 'remarks', e.target.value)}
                        placeholder="Optional"  />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Document */}
          <div>
            <label className="lbl">Document (optional)</label>
            <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center', padding: '10px 14px', border: '1.5px dashed var(--border)', borderRadius: 10 }}>
              <Upload size={14} />
              {uploadedFile ? uploadedFile.name : 'Choose File'}
            </button>
            <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => setUploadedFile(e.target.files?.[0] || null)} />
          </div>

          {/* Remarks */}
          <div>
            <label className="lbl">Remarks</label>
            <textarea className="inp" rows={2} placeholder="Additional notes…"
              value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical', }} />
          </div>

          {/* Submit */}
          <button type="submit" className="btn-primary" disabled={!valid || saving}
            style={{ marginTop: 4, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12 }}>
            {saving
              ? <><Loader2 size={16} className="spin" /> Creating...</>
              : <><ArrowLeftRight size={16} /> Create Transfer & Gate Pass</>}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Transfer Detail Modal ────────────────────────────────────────────────────

function TransferDetailModal({ transfer, transferItems, onClose, onConfirm, onReject, confirming, rejecting, onPrintGatePass }) {
  const t = transfer
  const initiator = t.initiator || {}
  const confirmer = t.confirmer || {}
  const items = transferItems || []

  return (
    <ModalShell onClose={onClose} accent={STATUS_CONFIG[t.status]?.color || 'var(--accent)'} wide>
      <h3 style={{ textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 20, color: 'var(--text-0)' }}>
        <Eye size={18} style={{ marginRight: 8, verticalAlign: 'middle', color: 'var(--accent)' }} />
        Asset Transfer / Gate Pass Details
      </h3>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--accent)' }}>{t.transfer_no}</span>
          {t.gate_pass_no && (
            <span style={{ color: 'var(--text-3)', background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 6 }}>
              GP: {t.gate_pass_no}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <PassTypeBadge type={t.pass_type} />
          <StatusBadge status={t.status} />
        </div>
      </div>

      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginBottom: 20 }}>
        <div>
          <div style={{ color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>From Site</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, }}>
            <MapPin size={13} style={{ color: 'var(--red)' }} />{t.from_site || '-'}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>To Site</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, }}>
            <MapPin size={13} style={{ color: 'var(--green)' }} />{t.to_site || '-'}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Initiated By</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, }}>
            <User size={13} style={{ color: 'var(--text-3)' }} />{initiator.full_name || '-'}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date</div>
          <div >{fmtDateTime(t.created_at)}</div>
        </div>
        {t.purpose && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Purpose</div>
            <div >{t.purpose}</div>
          </div>
        )}
      </div>

      {/* Carrier */}
      {(t.vehicle_no || t.carrier_name || t.carrier_company) && (
        <div style={{ marginBottom: 16, background: 'var(--bg-1)', borderRadius: 10, border: '1px solid var(--border)', padding: '14px 16px' }}>
          <div style={{ color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Truck size={13} /> Carrier / Vehicle
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', }}>
            {t.carrier_name && <div><span style={{ color: 'var(--text-3)', }}>Driver: </span>{t.carrier_name}</div>}
            {t.carrier_company && <div><span style={{ color: 'var(--text-3)', }}>Transporter: </span>{t.carrier_company}</div>}
            {t.vehicle_no && <div><span style={{ color: 'var(--text-3)', }}>Vehicle: </span><strong>{t.vehicle_no}</strong></div>}
            {t.carrier_phone && <div><span style={{ color: 'var(--text-3)', }}>Phone: </span>{t.carrier_phone}</div>}
          </div>
        </div>
      )}

      {/* Items */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Assets / Items ({items.length})
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table className="tbl" style={{ margin: 0 }}>
            <thead><tr><th style={{ width: 36 }}>#</th><th>Description</th><th style={{ width: 60 }}>Unit</th><th style={{ width: 70 }}>Qty</th><th style={{ width: 120 }}>Remarks</th></tr></thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td style={{ textAlign: 'center', color: 'var(--text-3)' }}>{idx + 1}</td>
                  <td >
                    {item.description || item.assets?.asset_name || '-'}
                    {item.assets?.asset_code && <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>{item.assets.asset_code}</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>{item.unit || 'nos'}</td>
                  <td style={{ textAlign: 'center', }}>{item.quantity || 1}</td>
                  <td style={{ color: 'var(--text-2)' }}>{item.remarks || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button className="btn-ghost" onClick={() => onPrintGatePass(transfer)} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Printer size={14} /> Print Gate Pass
        </button>
        {t.status === 'pending' && (
          <>
            <button className="btn-ghost" onClick={() => onReject(transfer)} disabled={rejecting}
              style={{ color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <XCircle size={14} /> {rejecting ? 'Rejecting...' : 'Reject'}
            </button>
            <button className="btn-primary" onClick={() => onConfirm(transfer)} disabled={confirming}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle2 size={14} /> {confirming ? 'Confirming...' : 'Confirm & Transfer'}
            </button>
          </>
        )}
      </div>
    </ModalShell>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AssetTransferTab({ assets = [], sites = [], onRefresh }) {
  const { user } = useAuth()
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [detailTransfer, setDetailTransfer] = useState(null)
  const [detailItems, setDetailItems] = useState([])
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchTransfers = useCallback(async () => {
    setLoading(true)
    try {
      const { data: transfersData, error: transfersErr } = await supabase
        .from('asset_transfers')
        .select('*')
        .order('created_at', { ascending: false })
      if (transfersErr) throw transfersErr

      const { data: profilesData, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, full_name')
      if (profilesErr) throw profilesErr

      const profilesMap = {}
      if (profilesData) {
        profilesData.forEach(p => {
          profilesMap[p.id] = p.full_name
        })
      }

      const mapped = (transfersData || []).map(t => ({
        ...t,
        initiator: { full_name: profilesMap[t.initiated_by] || 'System' },
        confirmer: { full_name: profilesMap[t.confirmed_by] || '' }
      }))

      setTransfers(mapped)
    } catch (err) {
      console.error('Error fetching asset transfers:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTransfers() }, [fetchTransfers])

  async function fetchTransferItems(transferId) {
    const { data } = await supabase
      .from('asset_transfer_items')
      .select('*, assets(asset_name, asset_code)')
      .eq('transfer_id', transferId)
      .order('created_at')
    return data || []
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = transfers.length
    const pending = transfers.filter(t => t.status === 'pending').length
    const confirmed = transfers.filter(t => t.status === 'confirmed').length
    const rejected = transfers.filter(t => t.status === 'rejected').length
    return { total, pending, confirmed, rejected }
  }, [transfers])

  // ── Filter ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let rows = transfers
    if (statusFilter !== 'all') rows = rows.filter(t => t.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(t =>
        (t.transfer_no || '').toLowerCase().includes(q) ||
        (t.gate_pass_no || '').toLowerCase().includes(q) ||
        (t.from_site || '').toLowerCase().includes(q) ||
        (t.to_site || '').toLowerCase().includes(q) ||
        (t.vehicle_no || '').toLowerCase().includes(q) ||
        (t.purpose || '').toLowerCase().includes(q) ||
        (t.carrier_name || '').toLowerCase().includes(q)
      )
    }
    return rows
  }, [transfers, statusFilter, search])

  // ── Create Transfer ──────────────────────────────────────────────────────

  async function handleCreateTransfer(form, lineItems, file) {
    const transfer_no = generateDocNo('ATR')
    const gate_pass_no = generateDocNo('GP')

    let document_url = null, document_name = null

    if (file) {
      const tempId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
      const path = `asset-transfers/${tempId}/${file.name}`
      const { error: uploadErr } = await supabase.storage.from('material-documents').upload(path, file)
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage.from('material-documents').getPublicUrl(path)
      document_url = publicUrl
      document_name = file.name
    }

    const { data: inserted, error } = await supabase
      .from('asset_transfers')
      .insert({
        transfer_no, gate_pass_no,
        pass_type: form.pass_type,
        from_site: form.from_site,
        to_site: form.to_site,
        purpose: form.purpose.trim() || null,
        status: 'pending',
        notes: form.notes.trim() || null,
        document_url, document_name,
        initiated_by: user?.id,
        vehicle_no: form.vehicle_no.trim() || null,
        carrier_name: form.carrier_name.trim() || null,
        carrier_company: form.carrier_company.trim() || null,
        carrier_phone: form.carrier_phone.trim() || null,
        ref_mtv_no: form.ref_mtv_no.trim() || null,
        expected_at: new Date().toISOString(),
      })
      .select('id').single()

    if (error) throw error

    if (inserted?.id) {
      const itemRows = lineItems.map(li => ({
        transfer_id: inserted.id,
        asset_id: li.asset_id || null,
        description: li.description.trim(),
        quantity: Number(li.quantity || 1),
        unit: li.unit || 'nos',
        remarks: li.remarks?.trim() || null,
      }))
      const { error: itemErr } = await supabase.from('asset_transfer_items').insert(itemRows)
      if (itemErr) throw itemErr
    }

    const { data: initiatorProfile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).single()
    const initiatorName = initiatorProfile?.full_name || 'Unknown'
    await notifyUsersAtSite(
      form.to_site,
      'Asset Transfer Incoming',
      `${lineItems.length} asset(s) from ${form.from_site} → ${form.to_site} by ${initiatorName} | GP: ${gate_pass_no}`,
      '/materials',
      'transfer_asset'
    )

    await fetchTransfers()
    if (onRefresh) onRefresh()
  }

  // ── Confirm Transfer ─────────────────────────────────────────────────────

  async function handleConfirmTransfer(t) {
    setConfirming(true)
    try {
      const items = await fetchTransferItems(t.id)

      // For each item with an asset_id, handle transfer
      for (const item of items) {
        if (!item.asset_id) continue

        // Check if this is a bulk asset needing partial transfer
        const { data: assetData } = await supabase.from('assets').select('asset_type, quantity').eq('id', item.asset_id).single()
        const isBulk = assetData?.asset_type === 'bulk' || (Number(assetData?.quantity) > 1)

        if (isBulk && Number(item.quantity) < Number(assetData.quantity)) {
          // Partial bulk transfer - use atomic RPC
          await bulkTransferAsset(
            item.asset_id,
            Number(item.quantity),
            t.to_site,
            user?.id,
            `Transfer ${t.transfer_no} (GP: ${t.gate_pass_no || ''}) - ${item.description || ''}`
          )
        } else {
          // Full transfer (serialized or entire bulk qty) - move the asset
          const { error: assetErr } = await supabase
            .from('assets')
            .update({ site: t.to_site, updated_at: new Date().toISOString() })
            .eq('id', item.asset_id)
          if (assetErr) throw assetErr

          // Log movement
          await supabase.from('asset_movements').insert({
            asset_id: item.asset_id,
            moved_by: user?.id,
            movement_type: 'transfer',
            from_location: t.from_site,
            to_location: t.to_site,
            notes: `Transfer ${t.transfer_no} (GP: ${t.gate_pass_no || ''}) - ${item.description || ''}`,
          })
        }
      }

      // Update transfer status
      const { error: updateErr } = await supabase
        .from('asset_transfers')
        .update({ status: 'confirmed', confirmed_by: user?.id, confirmed_at: new Date().toISOString() })
        .eq('id', t.id)
      if (updateErr) throw updateErr

      await notifyUsersAtSite(
        t.to_site,
        'Asset Transfer Confirmed',
        `Transfer ${t.transfer_no} (GP: ${t.gate_pass_no || ''}) confirmed. Assets now at ${t.to_site}.`,
        '/materials',
        'transfer_asset'
      )

      setDetailTransfer(null)
      await fetchTransfers()
      if (onRefresh) onRefresh()
    } catch (err) {
      console.error('Confirm transfer error:', err)
      alert('Failed to confirm: ' + (err.message || err))
    } finally {
      setConfirming(false)
    }
  }

  // ── Reject Transfer ──────────────────────────────────────────────────────

  async function handleRejectTransfer(t) {
    const reason = prompt('Enter rejection reason:')
    if (!reason || !reason.trim()) return
    setRejecting(true)
    try {
      const { error } = await supabase
        .from('asset_transfers')
        .update({ status: 'rejected', rejected_reason: reason.trim() })
        .eq('id', t.id)
      if (error) throw error
      setDetailTransfer(null)
      await fetchTransfers()
    } catch (err) {
      alert('Failed to reject: ' + (err.message || err))
    } finally {
      setRejecting(false)
    }
  }

  // ── View Detail ──────────────────────────────────────────────────────────

  async function openDetail(t) {
    const items = await fetchTransferItems(t.id)
    setDetailItems(items)
    setDetailTransfer(t)
  }

  async function handlePrintGatePass(t) {
    const items = await fetchTransferItems(t.id)
    printGatePass(t, items)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Stats */}
      <div className="mat-sub-stats">
        <div className="mat-sub-stat" data-accent="accent">
          <div className="mat-sub-stat-icon"><ArrowLeftRight size={18} /></div>
          <div className="mat-sub-stat-val">{stats.total}</div>
          <div className="mat-sub-stat-label">Total</div>
        </div>
        <div className="mat-sub-stat" data-accent="amber">
          <div className="mat-sub-stat-icon"><Clock size={18} /></div>
          <div className="mat-sub-stat-val">{stats.pending}</div>
          <div className="mat-sub-stat-label">Pending</div>
        </div>
        <div className="mat-sub-stat" data-accent="green">
          <div className="mat-sub-stat-icon"><CheckCircle2 size={18} /></div>
          <div className="mat-sub-stat-val">{stats.confirmed}</div>
          <div className="mat-sub-stat-label">Confirmed</div>
        </div>
        <div className="mat-sub-stat" data-accent="red">
          <div className="mat-sub-stat-icon"><XCircle size={18} /></div>
          <div className="mat-sub-stat-val">{stats.rejected}</div>
          <div className="mat-sub-stat-label">Rejected</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 16px' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input className="inp" placeholder="Search transfers, gate pass, vehicle..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 34, width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'pending', 'confirmed', 'rejected'].map(f => (
            <button key={f}
              className={statusFilter === f ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '4px 12px', borderRadius: 20 }}
              onClick={() => setStatusFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <Plus size={15} /> New Transfer / Gate Pass
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, color: 'var(--text-3)' }}>
          <Loader2 size={22} className="spin" style={{ marginRight: 8 }} /> Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-3)' }}>
          <ArrowLeftRight size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ textTransform: 'uppercase', marginBottom: 4 }}>
            {search || statusFilter !== 'all' ? 'No matching transfers' : 'No asset transfers yet'}
          </div>
          <div >
            {search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Click "New Transfer / Gate Pass" to get started'}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="card desktop-table" style={{ overflow: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Gate Pass No</th>
                  <th>Type</th>
                  <th>From Site</th>
                  <th>To Site</th>
                  <th>Purpose</th>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th>Initiated By</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap', }}>{fmtDate(t.created_at)}</td>
                    <td>
                      <div style={{ color: 'var(--accent)', }}>{t.gate_pass_no}</div>
                      <div style={{ color: 'var(--text-3)' }}>{t.transfer_no}</div>
                    </td>
                    <td><PassTypeBadge type={t.pass_type} /></td>
                    <td ><MapPin size={11} style={{ color: 'var(--red)', marginRight: 3 }} />{t.from_site}</td>
                    <td ><MapPin size={11} style={{ color: 'var(--green)', marginRight: 3 }} />{t.to_site}</td>
                    <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.purpose || '-'}</td>
                    <td >{t.vehicle_no || '-'}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td >{t.initiator?.full_name || '-'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => openDetail(t)} title="View"
                        style={{ background: 'var(--accent-glow)', border: '1.5px solid var(--accent-soft)',
                          borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: 'var(--accent)', marginRight: 4 }}>
                        <Eye size={14} />
                      </button>
                      <button onClick={() => handlePrintGatePass(t)} title="Print"
                        style={{ background: 'var(--bg-3)', border: '1.5px solid var(--border)',
                          borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: 'var(--text-2)' }}>
                        <Printer size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="mobile-cards" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(t => (
              <div key={t.id} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => openDetail(t)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: 'var(--accent)' }}>{t.gate_pass_no}</span>
                  <span style={{ color: 'var(--text-3)' }}>{fmtDate(t.created_at)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: 8 }}>
                  <div>
                    <div style={{ color: 'var(--text-3)', marginBottom: 1 }}>From</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={11} style={{ color: 'var(--red)' }} />{t.from_site}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-3)', marginBottom: 1 }}>To</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={11} style={{ color: 'var(--green)' }} />{t.to_site}</div>
                  </div>
                </div>
                {t.purpose && <div style={{ color: 'var(--text-2)', marginBottom: 8 }}>{t.purpose}</div>}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <PassTypeBadge type={t.pass_type} />
                  <StatusBadge status={t.status} />
                  {t.vehicle_no && <span style={{ color: 'var(--text-3)', marginLeft: 'auto' }}>{t.vehicle_no}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateTransferModal
          onClose={() => setShowCreate(false)}
          assets={assets}
          sites={sites}
          onSubmit={handleCreateTransfer}
        />
      )}

      {/* Detail Modal */}
      {detailTransfer && (
        <TransferDetailModal
          transfer={detailTransfer}
          transferItems={detailItems}
          onClose={() => setDetailTransfer(null)}
          onConfirm={handleConfirmTransfer}
          onReject={handleRejectTransfer}
          confirming={confirming}
          rejecting={rejecting}
          onPrintGatePass={handlePrintGatePass}
        />
      )}
    </div>
  )
}


