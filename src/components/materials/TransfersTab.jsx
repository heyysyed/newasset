import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Plus, Search, X, Loader2, ArrowLeftRight,
  CheckCircle2, XCircle, Clock, Eye, FileText,
  MapPin, Package, Hash, User, Calendar,
  Upload, Download, AlertTriangle, Truck, Printer,
  ArrowUpRight, ArrowDownLeft, RotateCcw, Trash2,
} from 'lucide-react'
import { supabase, notifyUsersAtSite } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ModalShell from './ModalShell'
import { generateDocNo, fmtDate, fmtDateTime, trashSave } from './helpers'
import companyLogo from '../../assets/logo.png'

const PASS_TYPE_CONFIG = {
  material_out: { label: 'Material Out', color: 'var(--red)',   bg: 'var(--status-danger-soft)', icon: ArrowUpRight },
  material_in:  { label: 'Material In',  color: 'var(--green)', bg: 'rgba(34,197,94,0.08)', icon: ArrowDownLeft },
  returnable:   { label: 'Returnable',   color: 'var(--status-warning)',      bg: 'var(--status-warning-soft)', icon: RotateCcw },
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'var(--amber)', bg: 'var(--amber-dim)', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'var(--green)', bg: 'var(--green-dim)', icon: CheckCircle2 },
  rejected:  { label: 'Rejected',  color: 'var(--red)',   bg: 'var(--red-dim)',   icon: XCircle },
}

function generateTransferNo() { return generateDocNo('TRF') }
function generateGatePassNo() { return generateDocNo('GP') }

// ── Badges ───────────────────────────────────────────────────────────────────

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

// ── Gate Pass Print ──────────────────────────────────────────────────────────

function printGatePass(transfer, transferItems) {
  const t = transfer
  const initiator = t.initiator || {}
  const confirmer = t.confirmer || {}
  const items = transferItems || []

  const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
  const confirmedDateStr = t.confirmed_at ? new Date(t.confirmed_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

  const passTypeLabel = PASS_TYPE_CONFIG[t.pass_type]?.label || 'Material Out'

  // Build items rows
  const itemRows = items.length > 0
    ? items.map((item, idx) => `
      <tr>
        <td class="sr-col">${idx + 1}</td>
        <td>${item.description || (item.materials?.material_name || '')}${item.materials?.material_code ? ' (' + item.materials.material_code + ')' : ''}</td>
        <td class="unit-col">${item.unit || item.materials?.unit || ''}</td>
        <td class="qty-col" style="font-weight:bold;">${item.quantity || ''}</td>
        <td>${item.remarks || ''}</td>
      </tr>`).join('')
    : `<tr>
        <td class="sr-col">1</td>
        <td>${t.materials?.material_name || ''}${t.materials?.material_code ? ' (' + t.materials.material_code + ')' : ''}</td>
        <td class="unit-col">${t.materials?.unit || ''}</td>
        <td class="qty-col" style="font-weight:bold;">${t.quantity || ''}</td>
        <td>${t.notes || ''}</td>
      </tr>`

  // Fill empty rows to match physical form (total ~12 rows)
  const filledCount = items.length > 0 ? items.length : 1
  const emptyRows = Math.max(0, 11 - filledCount)
  const emptyRowsHtml = Array.from({ length: emptyRows }, () => `
    <tr class="empty-row"><td class="sr-col"></td><td></td><td class="unit-col"></td><td class="qty-col"></td><td></td></tr>`).join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Gate Pass - ${t.gate_pass_no || t.transfer_no}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-size: 13px; color: #000; background: #fff; }
    .gate-pass { max-width: 780px; margin: 0 auto; border: 2px solid #000; padding: 0; }
    .header { text-align: center; padding: 16px 20px 12px; border-bottom: 2px solid #000; position: relative; }
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
    .remarks-col { width: 140px; }
    .empty-row td { height: 28px; }

    .footer-section { border-top: 1.5px solid #000; }
    .footer-row { display: flex; border-bottom: 1px solid #000; }
    .footer-row:last-child { border-bottom: none; }
    .footer-cell { flex: 1; padding: 8px 12px; border-right: 1px solid #000; }
    .footer-cell:last-child { border-right: none; }
    .footer-label { font-size: 11px; font-weight: bold; color: #333; }
    .footer-value { font-size: 13px; min-height: 16px; margin-top: 2px; }

    .signature-section { display: flex; border-top: 1.5px solid #000; }
    .signature-block { flex: 1; padding: 12px 16px; min-height: 70px; border-right: 1px solid #000; display: flex; flex-direction: column; justify-content: space-between; }
    .signature-block:last-child { border-right: none; }
    .signature-label { font-size: 11px; font-weight: bold; text-align: center; color: #333; }
    .signature-name { font-size: 12px; text-align: center; margin-top: 8px; font-style: italic; color: #444; }
    .signature-line { border-bottom: 1px solid #999; margin-top: auto; margin-bottom: 4px; height: 30px; }

    .status-badge { display: inline-block; padding: 2px 10px; border-radius: 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .status-pending { background: #fff3cd; color: #856404; border: 1px solid #ffc107; }
    .status-confirmed { background: #d4edda; color: #155724; border: 1px solid #28a745; }
    .status-rejected { background: #f8d7da; color: #721c24; border: 1px solid #dc3545; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div style="text-align:center; margin: 10px 0 16px;" class="no-print">
    <button onclick="window.print()" style="padding:10px 28px; font-size:15px; font-weight:bold; cursor:pointer; background:var(--accent); color:white; border:none; border-radius:6px;">
      Print / Download PDF
    </button>
  </div>

  <div class="gate-pass">
    <div class="header" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px;">
      <div>
        <img src="${companyLogo}" alt="Company Logo" style="height: 80px; object-fit: contain;" />
      </div>
      <div style="text-align: right;">
        <div class="company-name" style="margin-bottom: 2px; text-align: right;">Strongbuilt Construction Pvt. Ltd.</div>
        <div class="gate-pass-title" style="margin-bottom: 4px; text-align: right;">GATE PASS RETURN</div>
        <div class="gp-no" style="text-align: right;">
          Gate Pass No. <span style="font-size:20px; text-decoration:underline;">${t.gate_pass_no || t.transfer_no}</span>
        </div>
      </div>
    </div>

    <!-- Site & Date -->
    <div class="info-row">
      <div class="info-cell" style="flex:1.3;">
        <div class="info-label">Site Stamp & Address</div>
        <div class="info-value" style="font-size:15px;">${t.from_site || ''}</div>
        ${t.gate_name ? `<div style="font-size:11px; color:#555; margin-top:2px;">Gate: ${t.gate_name}</div>` : ''}
      </div>
      <div class="info-cell" style="flex:0.7;">
        <div style="margin-bottom:8px;">
          <div class="info-label">Date</div>
          <div class="info-value">${dateStr}</div>
        </div>
        <div>
          <div class="info-label">Status</div>
          <span class="status-badge status-${t.status}">${(t.status || 'pending').toUpperCase()}</span>
        </div>
      </div>
    </div>

    <!-- Purpose Row -->
    ${t.purpose ? `
    <div class="info-row">
      <div class="info-cell" style="border-right:none;">
        <div class="info-label">Purpose</div>
        <div class="info-value">${t.purpose}</div>
      </div>
    </div>` : ''}

    <!-- Materials Table -->
    <table>
      <thead>
        <tr>
          <th class="sr-col">Sr. No.</th>
          <th>Description of Material</th>
          <th class="unit-col">Unit</th>
          <th class="qty-col">Qty.</th>
          <th class="remarks-col">Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        ${emptyRowsHtml}
      </tbody>
    </table>

    <!-- Transport Details -->
    <div class="footer-section">
      <div class="footer-row">
        <div class="footer-cell">
          <div class="footer-label">Ref. MTV No.</div>
          <div class="footer-value">${t.ref_mtv_no || t.transfer_no || ''}</div>
        </div>
        <div class="footer-cell">
          <div class="footer-label">Vehicle No.</div>
          <div class="footer-value" style="font-weight:bold;">${t.vehicle_no || ''}</div>
        </div>
      </div>
      <div class="footer-row">
        <div class="footer-cell" style="border-right:none;">
          <div class="footer-label">Name of Transport</div>
          <div class="footer-value">${t.transport_name || t.carrier_company || ''} ${t.carrier_name ? '(Driver: ' + t.carrier_name + ')' : ''}</div>
        </div>
      </div>
    </div>

    <!-- From / To -->
    <div class="footer-section">
      <div class="footer-row">
        <div class="footer-cell">
          <div class="footer-label">From Site (Sender)</div>
          <div class="footer-value" style="font-weight:bold; font-size:14px;">${t.from_site || ''}</div>
        </div>
        <div class="footer-cell">
          <div class="footer-label">To Site (Receiver)</div>
          <div class="footer-value" style="font-weight:bold; font-size:14px;">${t.to_site || ''}</div>
        </div>
      </div>
    </div>

    <!-- Signatures -->
    <div class="signature-section">
      <div class="signature-block">
        <div class="signature-label">Store In-charge (Sender Site)</div>
        <div class="signature-line"></div>
        <div class="signature-name">${initiator.full_name || ''}</div>
      </div>
      <div class="signature-block">
        <div class="signature-label">Receiver's Signature</div>
        <div class="signature-line"></div>
        <div class="signature-name">${t.status === 'confirmed' ? (confirmer.full_name || 'Accepted') : '(Pending acceptance)'}</div>
        ${t.status === 'confirmed' ? `<div style="font-size:10px; text-align:center; color:#155724; margin-top:2px;">Accepted on ${confirmedDateStr}</div>` : ''}
      </div>
    </div>
    <div class="signature-section" style="border-top: 1px solid #000;">
      <div class="signature-block">
        <div class="signature-label">Project In-Charge (Sender Site)</div>
        <div class="signature-line"></div>
      </div>
      <div class="signature-block">
        <div class="signature-label">Receiver's Signature</div>
        <div class="signature-line"></div>
        <div class="signature-name">${t.status === 'confirmed' ? (confirmer.full_name || 'Accepted') : ''}</div>
      </div>
    </div>
  </div>

  <div style="text-align:center; margin-top:12px; font-size:11px; color:#999;" class="no-print">
    Generated digitally from AssetPro &mdash; ${new Date().toLocaleString('en-IN')}
  </div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}

// ── Create Transfer / Gate Pass Modal ────────────────────────────────────────

function CreateTransferModal({ onClose, materials, stock, sites, onSubmit }) {
  const [form, setForm] = useState({
    pass_type: 'material_out',
    from_site: '',
    to_site: '',
    purpose: '',
    vehicle_no: '',
    transport_name: '',
    carrier_name: '',
    carrier_company: '',
    carrier_phone: '',
    ref_mtv_no: '',
    notes: '',
  })
  const [lineItems, setLineItems] = useState([
    { material_id: '', description: '', quantity: '', unit: 'nos', remarks: '' }
  ])
  const [saving, setSaving] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const fileRef = useRef(null)

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const isOut = form.pass_type === 'material_out' || form.pass_type === 'returnable'

  // ── Line item helpers ─────────────────────────────────────────
  function addLine() {
    setLineItems(p => [...p, { material_id: '', description: '', quantity: '', unit: 'nos', remarks: '' }])
  }
  function removeLine(i) {
    setLineItems(p => p.filter((_, idx) => idx !== i))
  }
  function updateLine(i, field, val) {
    setLineItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  }
  function pickMaterial(i, matId) {
    const mat = materials.find(m => m.id === matId)
    if (mat) {
      setLineItems(p => p.map((it, idx) => idx === i ? {
        ...it,
        material_id: matId,
        description: `${mat.material_name}`,
        unit: mat.unit || it.unit,
      } : it))
    } else {
      setLineItems(p => p.map((it, idx) => idx === i ? { ...it, material_id: '', description: '' } : it))
    }
  }

  // Sites that have stock (for material_out)
  const fromSiteOptions = useMemo(() => {
    if (!isOut) return sites
    return sites
  }, [sites, isOut])

  const toSiteOptions = useMemo(() => {
    return sites.filter(s => s !== form.from_site)
  }, [sites, form.from_site])

  // Check if at least one valid item
  const hasValidItem = lineItems.some(li => li.description.trim() && Number(li.quantity) > 0)
  const valid = form.from_site && form.to_site && hasValidItem

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    try {
      await onSubmit(form, lineItems.filter(li => li.description.trim() && Number(li.quantity) > 0), uploadedFile)
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
        style={{
          width: '100%', maxWidth: 680, maxHeight: '95vh', overflow: 'auto',
          borderRadius: '20px 20px 0 0', padding: 0,
          animation: 'fadeUp 0.25s ease-out',
          borderTop: `3px solid ${passTypeCfg?.color || 'var(--accent)'}`,
        }}>

        {/* ── Sticky Header ─────────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-2)',
          padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-0)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={16} style={{ color: passTypeCfg?.color || 'var(--accent)' }} />
            New Transfer / Gate Pass
          </h3>
          <button onClick={onClose} style={{ background: 'var(--bg-3)', border: '1.5px solid var(--border)', borderRadius: 10, width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-3)', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Pass Type ─────────────────────────────────────────── */}
          <div>
            <label className="lbl">Pass Type *</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {Object.entries(PASS_TYPE_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon
                const active = form.pass_type === key
                return (
                  <button type="button" key={key} onClick={() => set('pass_type', key)}
                    style={{
                      flex: 1, padding: '10px 4px', borderRadius: 10,
                      border: `1.5px solid ${active ? cfg.color : 'var(--border)'}`,
                      background: active ? cfg.bg : 'var(--bg-3)',
                      color: active ? cfg.color : 'var(--text-3)',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textTransform: 'uppercase',
                      transition: 'all 0.15s',
                    }}>
                    <Icon size={16} />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── From / To Sites ───────────────────────────────────── */}
          <div>
            <label className="lbl">{isOut ? 'From Site (Sender) *' : 'Source Site *'}</label>
            <select className="sel" value={form.from_site} onChange={e => set('from_site', e.target.value)} style={{ marginBottom: 10 }}>
              <option value="">Select site...</option>
              {fromSiteOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="lbl">{isOut ? 'To Site (Receiver) *' : 'Destination Site *'}</label>
            <select className="sel" value={form.to_site} onChange={e => set('to_site', e.target.value)}>
              <option value="">Select site...</option>
              {toSiteOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* ── Purpose ─────────────────────────────────────────────── */}
          <div>
            <label className="lbl">Purpose</label>
            <input className="inp" placeholder="Reason for material movement" value={form.purpose} onChange={e => set('purpose', e.target.value)} />
          </div>

          {/* ── Carrier / Vehicle ──────────────────────────────────── */}
          <div style={{ background: 'var(--bg-1)', borderRadius: 12, padding: '14px 14px', border: '1px solid var(--border)' }}>
            <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}>
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

          {/* ── Line Items (mobile-friendly card layout) ──────────── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label className="lbl" style={{ margin: 0 }}>Materials / Items *</label>
              <button type="button" onClick={addLine} className="btn-ghost" style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8 }}>
                <Plus size={13} /> Add
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lineItems.map((li, i) => (
                <div key={i} style={{
                  background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12,
                  padding: '12px 12px', position: 'relative',
                }}>
                  {/* Item number + delete */}
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

                  {/* Material select */}
                  <select className="sel" style={{ width: '100%', marginBottom: 8 }}
                    value={li.material_id || ''}
                    onChange={e => pickMaterial(i, e.target.value)}>
                    <option value="">Custom item...</option>
                    <optgroup label="Materials">
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>{m.material_code ? `${m.material_code} - ` : ''}{m.material_name}</option>
                      ))}
                    </optgroup>
                  </select>

                  {/* Description */}
                  <input className="inp" value={li.description} onChange={e => updateLine(i, 'description', e.target.value)}
                    placeholder="Description" style={{ width: '100%', marginBottom: 8 }} />

                  {/* Qty + Unit + Remarks in a row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 6 }}>
                    <div>
                      <label style={{ color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>Qty *</label>
                      <input className="inp" type="number" min="0.01" step="any" value={li.quantity}
                        onChange={e => updateLine(i, 'quantity', e.target.value)}
                        placeholder="0" style={{ textAlign: 'center' }} />
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

          {/* ── Document ───────────────────────────────────────────── */}
          <div>
            <label className="lbl">Document (optional)</label>
            <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center', padding: '10px 14px', border: '1.5px dashed var(--border)', borderRadius: 10 }}>
              <Upload size={14} />
              {uploadedFile ? uploadedFile.name : 'Choose File'}
            </button>
            <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => setUploadedFile(e.target.files?.[0] || null)} />
          </div>

          {/* ── Remarks ────────────────────────────────────────────── */}
          <div>
            <label className="lbl">Remarks</label>
            <textarea className="inp" rows={2} placeholder="Additional notes…"
              value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical', }} />
          </div>

          {/* ── Submit ──────────────────────────────────────────────── */}
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
  const mat = t.materials || {}
  const initiator = t.initiator || {}
  const confirmer = t.confirmer || {}
  const items = transferItems || []

  return (
    <ModalShell onClose={onClose} accent={STATUS_CONFIG[t.status]?.color || 'var(--accent)'} wide>
      <h3 style={{ textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 20, color: 'var(--text-0)' }}>
        <Eye size={18} style={{ marginRight: 8, verticalAlign: 'middle', color: 'var(--accent)' }} />
        Transfer / Gate Pass Details
      </h3>

      {/* Header: Nos + Status + Type */}
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
          {t.gate_name && <div style={{ color: 'var(--text-3)', marginTop: 2 }}>Gate: {t.gate_name}</div>}
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

      {/* Carrier / Transport */}
      {(t.vehicle_no || t.carrier_name || t.carrier_company || t.transport_name || t.carrier_phone || t.ref_mtv_no) && (
        <div style={{ marginBottom: 16, background: 'var(--bg-1)', borderRadius: 10, border: '1px solid var(--border)', padding: '14px 16px' }}>
          <div style={{ color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Truck size={13} /> Carrier / Vehicle
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', }}>
            {t.carrier_name && <div><span style={{ color: 'var(--text-3)', }}>Driver: </span>{t.carrier_name}</div>}
            {t.carrier_company && <div><span style={{ color: 'var(--text-3)', }}>Transporter: </span>{t.carrier_company}</div>}
            {t.vehicle_no && <div><span style={{ color: 'var(--text-3)', }}>Vehicle: </span><strong>{t.vehicle_no}</strong></div>}
            {t.carrier_phone && <div><span style={{ color: 'var(--text-3)', }}>Phone: </span>{t.carrier_phone}</div>}
            {t.transport_name && <div><span style={{ color: 'var(--text-3)', }}>Transport: </span>{t.transport_name}</div>}
            {t.ref_mtv_no && <div><span style={{ color: 'var(--text-3)', }}>Ref. MTV No: </span><span >{t.ref_mtv_no}</span></div>}
          </div>
        </div>
      )}

      {/* Items Table */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Materials / Items ({items.length > 0 ? items.length : 1})
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table className="tbl" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Description</th>
                <th style={{ width: 60 }}>Unit</th>
                <th style={{ width: 70 }}>Qty</th>
                <th style={{ width: 120 }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? items.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td style={{ textAlign: 'center', color: 'var(--text-3)' }}>{idx + 1}</td>
                  <td >
                    {item.description || item.materials?.material_name || '-'}
                    {item.materials?.material_code && <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>{item.materials.material_code}</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>{item.unit || item.materials?.unit || ''}</td>
                  <td style={{ textAlign: 'center', }}>{item.quantity}</td>
                  <td style={{ color: 'var(--text-2)' }}>{item.remarks || ''}</td>
                </tr>
              )) : (
                <tr>
                  <td style={{ textAlign: 'center', color: 'var(--text-3)' }}>1</td>
                  <td >{mat.material_name || '-'} <span style={{ color: 'var(--text-3)', }}>{mat.material_code || ''}</span></td>
                  <td style={{ textAlign: 'center' }}>{mat.unit || ''}</td>
                  <td style={{ textAlign: 'center', }}>{t.quantity}</td>
                  <td style={{ color: 'var(--text-2)' }}>{t.notes || ''}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      {t.notes && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Remarks</div>
          <div style={{ color: 'var(--text-1)', background: 'var(--bg-1)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
            {t.notes}
          </div>
        </div>
      )}

      {/* Document */}
      {t.document_url && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Document</div>
          <a href={t.document_url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent)',
              background: 'var(--bg-1)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', textDecoration: 'none' }}>
            <Download size={14} />{t.document_name || 'View Document'}
          </a>
        </div>
      )}

      {/* Timeline */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Timeline</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ArrowLeftRight size={13} style={{ color: '#fff' }} />
            </div>
            <div>
              <div >Transfer Initiated & Gate Pass Generated</div>
              <div style={{ color: 'var(--text-3)' }}>{fmtDateTime(t.created_at)} by {initiator.full_name || '-'}</div>
            </div>
          </div>

          {t.status === 'confirmed' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle2 size={13} style={{ color: '#fff' }} />
              </div>
              <div>
                <div style={{ color: 'var(--green)' }}>Confirmed - Receiver Accepted</div>
                <div style={{ color: 'var(--text-3)' }}>{fmtDateTime(t.confirmed_at)} by {confirmer.full_name || '-'}</div>
              </div>
            </div>
          )}

          {t.status === 'rejected' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <XCircle size={13} style={{ color: '#fff' }} />
              </div>
              <div>
                <div style={{ color: 'var(--red)' }}>Transfer Rejected</div>
                <div style={{ color: 'var(--text-3)' }}>{fmtDateTime(t.rejected_at)}</div>
                {t.reject_reason && <div style={{ color: 'var(--text-2)', marginTop: 2 }}>Reason: {t.reject_reason}</div>}
              </div>
            </div>
          )}

          {t.status === 'pending' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--amber-dim)', border: '2px dashed var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={13} style={{ color: 'var(--amber)' }} />
              </div>
              <div><div style={{ color: 'var(--amber)' }}>Awaiting Confirmation from Receiver Site</div></div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
        <button className="btn-ghost" onClick={() => onPrintGatePass(t)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid var(--accent)', color: 'var(--accent)' }}>
          <Printer size={14} /> Download Gate Pass
        </button>
        {t.status === 'pending' && (
          <>
            <button className="btn-primary" onClick={() => onConfirm(t)} disabled={confirming}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {confirming ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />} Confirm & Accept
            </button>
            <button className="btn-danger" onClick={() => onReject(t)} disabled={rejecting}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {rejecting ? <Loader2 size={14} className="spin" /> : <XCircle size={14} />} Reject
            </button>
          </>
        )}
      </div>
    </ModalShell>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function TransfersTab({ materials, stock, sites, onRefresh }) {
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

  // ── Fetch transfers ──────────────────────────────────────────────────────

  const fetchTransfers = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('material_transfers')
        .select(`
          *,
          materials(material_name, material_code, unit)
        `)
        .order('created_at', { ascending: false })

      // Fetch initiator/confirmer names separately since FK points to auth.users not profiles
      if (data?.length) {
        const userIds = [...new Set(data.map(t => t.initiated_by).concat(data.map(t => t.confirmed_by)).filter(Boolean))]
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]))
        for (const t of data) {
          t.initiator = { full_name: profileMap[t.initiated_by] || null }
          t.confirmer = { full_name: profileMap[t.confirmed_by] || null }
        }
      }

      if (error) throw error
      setTransfers(data || [])
    } catch (err) {
      console.error('Failed to fetch transfers:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTransfers() }, [fetchTransfers])

  // ── Fetch transfer items for detail view ─────────────────────────────────

  async function fetchTransferItems(transferId) {
    try {
      const { data, error } = await supabase
        .from('material_transfer_items')
        .select('*, materials(material_name, material_code, unit)')
        .eq('transfer_id', transferId)
        .order('created_at')
      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Failed to fetch transfer items:', err)
      return []
    }
  }

  async function openDetail(t) {
    setDetailTransfer(t)
    const items = await fetchTransferItems(t.id)
    setDetailItems(items)
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = transfers.length
    const pending = transfers.filter(t => t.status === 'pending').length
    const confirmed = transfers.filter(t => t.status === 'confirmed').length
    const rejected = transfers.filter(t => t.status === 'rejected').length
    return { total, pending, confirmed, rejected }
  }, [transfers])

  // ── Filtered transfers ───────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = transfers
    if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t => {
        const mat = t.materials || {}
        return (
          (t.transfer_no || '').toLowerCase().includes(q) ||
          (t.gate_pass_no || '').toLowerCase().includes(q) ||
          (mat.material_name || '').toLowerCase().includes(q) ||
          (mat.material_code || '').toLowerCase().includes(q) ||
          (t.from_site || '').toLowerCase().includes(q) ||
          (t.to_site || '').toLowerCase().includes(q) ||
          (t.vehicle_no || '').toLowerCase().includes(q) ||
          (t.carrier_name || '').toLowerCase().includes(q) ||
          (t.purpose || '').toLowerCase().includes(q) ||
          (t.initiator?.full_name || '').toLowerCase().includes(q)
        )
      })
    }
    return list
  }, [transfers, statusFilter, search])

  // ── Notify ───────────────────────────────────────────────────────────────
  // Notifications are sent only to users assigned to the relevant site

  async function getUserName() {
    try {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', user?.id).single()
      return data?.full_name || 'Unknown'
    } catch { return 'Unknown' }
  }

  // ── Print Gate Pass ─────────────────────────────────────────────────────

  async function handlePrintGatePass(t) {
    const items = await fetchTransferItems(t.id)
    printGatePass(t, items)
  }

  // ── Create Transfer ──────────────────────────────────────────────────────

  async function handleCreateTransfer(form, lineItems, file) {
    const transfer_no = generateTransferNo()
    const gate_pass_no = generateGatePassNo()

    let document_url = null
    let document_name = null

    const tempId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()

    if (file) {
      const path = `transfers/${tempId}/${file.name}`
      const { error: uploadErr } = await supabase.storage.from('material-documents').upload(path, file)
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage.from('material-documents').getPublicUrl(path)
      document_url = publicUrl
      document_name = file.name
    }

    // Use the first line item's material_id for backward compat (or null)
    const primaryMaterialId = lineItems[0]?.material_id || null
    const totalQty = lineItems.reduce((sum, li) => sum + Number(li.quantity || 0), 0)

    // Insert transfer
    const { data: inserted, error } = await supabase
      .from('material_transfers')
      .insert({
        transfer_no,
        gate_pass_no,
        pass_type: form.pass_type,
        material_id: primaryMaterialId,
        from_site: form.from_site,
        to_site: form.to_site,
        quantity: totalQty,
        status: 'pending',
        notes: form.notes.trim() || null,
        document_url,
        document_name,
        initiated_by: user?.id,
        vehicle_no: form.vehicle_no.trim() || null,
        transport_name: form.transport_name.trim() || null,
        carrier_name: form.carrier_name.trim() || null,
        carrier_company: form.carrier_company.trim() || null,
        carrier_phone: form.carrier_phone.trim() || null,
        ref_mtv_no: form.ref_mtv_no.trim() || null,
        gate_name: null,
        purpose: form.purpose.trim() || null,
        expected_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw error

    // Insert line items
    if (inserted?.id) {
      const itemRows = lineItems.map(li => ({
        transfer_id: inserted.id,
        material_id: li.material_id || null,
        description: li.description.trim(),
        quantity: Number(li.quantity || 0),
        unit: li.unit || 'nos',
        remarks: li.remarks?.trim() || null,
      }))
      const { error: itemErr } = await supabase.from('material_transfer_items').insert(itemRows)
      if (itemErr) throw itemErr
    }

    const userName = await getUserName()
    const itemSummary = lineItems.map(li => `${li.description} x${li.quantity}`).join(', ')
    await notifyUsersAtSite(
      form.to_site,
      'Transfer Incoming - Gate Pass Issued',
      `${itemSummary} from ${form.from_site} → ${form.to_site} by ${userName} | GP: ${gate_pass_no}`,
      '/materials',
      'transfer_material'
    )

    await fetchTransfers()
    onRefresh()
  }

  // ── Confirm Transfer ─────────────────────────────────────────────────────

  async function handleConfirmTransfer(t) {
    setConfirming(true)
    try {
      // Fetch line items for this transfer
      const items = await fetchTransferItems(t.id)

      // For each item with a material_id, update stock
      for (const item of items) {
        if (!item.material_id) continue
        const qty = Number(item.quantity)
        if (qty <= 0) continue

        // Check stock at from_site
        const { data: fromStock, error: fromErr } = await supabase
          .from('material_site_stock')
          .select('id, quantity')
          .eq('material_id', item.material_id)
          .eq('site', t.from_site)
          .single()

        if (fromErr && fromErr.code !== 'PGRST116') throw fromErr

        const availableQty = fromStock ? Number(fromStock.quantity) : 0
        const matInfo = item.materials || {}

        if (availableQty < qty) {
          alert(`Insufficient stock at ${t.from_site} for "${matInfo.material_name || item.description}"! Available: ${availableQty} ${matInfo.unit || ''}`)
          return
        }

        // Deduct from source
        await supabase
          .from('material_site_stock')
          .update({ quantity: availableQty - qty })
          .eq('id', fromStock.id)

        // Add to destination (upsert)
        const { data: toStock } = await supabase
          .from('material_site_stock')
          .select('id, quantity')
          .eq('material_id', item.material_id)
          .eq('site', t.to_site)
          .single()

        if (toStock) {
          await supabase
            .from('material_site_stock')
            .update({ quantity: Number(toStock.quantity) + qty })
            .eq('id', toStock.id)
        } else {
          await supabase
            .from('material_site_stock')
            .upsert({ material_id: item.material_id, site: t.to_site, quantity: qty }, { onConflict: 'material_id,site' })
        }

        // Transaction record
        const unitCost = materials.find(m => m.id === item.material_id)?.unit_cost || 0
        await supabase.from('material_transactions').insert({
          material_id: item.material_id,
          transaction_type: 'transfer',
          from_site: t.from_site,
          to_site: t.to_site,
          quantity: qty,
          notes: `Transfer ${t.transfer_no} - ${t.from_site} → ${t.to_site} | ${item.description || matInfo.material_name || ''}`,
          performed_by: user?.id,
          unit_cost: unitCost,
        })
      }

      // If no items but legacy single-material transfer
      if (items.length === 0 && t.material_id) {
        const qty = Number(t.quantity)
        const { data: fromStock } = await supabase
          .from('material_site_stock').select('id, quantity').eq('material_id', t.material_id).eq('site', t.from_site).single()
        const availableQty = fromStock ? Number(fromStock.quantity) : 0
        if (availableQty < qty) {
          alert(`Insufficient stock at ${t.from_site}! Available: ${availableQty}`)
          return
        }
        await supabase.from('material_site_stock').update({ quantity: availableQty - qty }).eq('id', fromStock.id)
        const { data: toStock } = await supabase.from('material_site_stock').select('id, quantity').eq('material_id', t.material_id).eq('site', t.to_site).single()
        if (toStock) {
          await supabase.from('material_site_stock').update({ quantity: Number(toStock.quantity) + qty }).eq('id', toStock.id)
        } else {
          await supabase.from('material_site_stock').upsert({ material_id: t.material_id, site: t.to_site, quantity: qty }, { onConflict: 'material_id,site' })
        }
        const unitCost = materials.find(m => m.id === t.material_id)?.unit_cost || 0
        await supabase.from('material_transactions').insert({
          material_id: t.material_id, transaction_type: 'transfer', from_site: t.from_site, to_site: t.to_site, quantity: qty,
          notes: `Transfer ${t.transfer_no} - ${t.from_site} → ${t.to_site}`, performed_by: user?.id, unit_cost: unitCost,
        })
      }

      // Update transfer status
      const { error: updateErr } = await supabase
        .from('material_transfers')
        .update({ status: 'confirmed', confirmed_by: user?.id, confirmed_at: new Date().toISOString() })
        .eq('id', t.id)
      if (updateErr) throw updateErr

      await notifyUsersAtSite(
        t.to_site,
        'Transfer Confirmed - Stock Received',
        `Transfer ${t.transfer_no} (GP: ${t.gate_pass_no || ''}) confirmed. Stock now updated at ${t.to_site}.`,
        '/materials',
        'transfer_material'
      )

      setDetailTransfer(null)
      await fetchTransfers()
      onRefresh()
    } catch (err) {
      console.error('Confirm transfer error:', err)
      alert('Failed to confirm: ' + (err.message || err))
    } finally {
      setConfirming(false)
    }
  }

  const [selectedIds, setSelectedIds] = useState(new Set())
  const toggleOne = id => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAll = () => setSelectedIds(prev => prev.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(t => t.id)))
  const clearSel = () => setSelectedIds(new Set())

  async function handleBulkDelete(ids) {
    if (!confirm(`Delete ${ids.length} transfer/gate pass record(s)?\n\nThey will be saved to Recycle Bin for recovery.`)) return
    try {
      const records = filtered.filter(t => ids.includes(t.id))
      trashSave('material_transfers', 'Transfer/Gate Pass', records)

      // Step 1: Delete child line items first to avoid foreign key constraint
      const itemsRes = await supabase
        .from('material_transfer_items')
        .delete()
        .in('transfer_id', ids)
      console.log('[Delete] material_transfer_items result:', itemsRes)
      if (itemsRes.error) throw new Error('Items delete failed: ' + itemsRes.error.message)

      // Step 2: Delete the transfer records
      const transferRes = await supabase
        .from('material_transfers')
        .delete()
        .in('id', ids)
      console.log('[Delete] material_transfers result:', transferRes)
      if (transferRes.error) throw new Error('Transfer delete failed: ' + transferRes.error.message)

      clearSel()
      await fetchTransfers()
    } catch (e) {
      console.error('[Delete] Error:', e)
      alert('Delete failed: ' + e.message)
    }
  }

  // ── Reject Transfer ──────────────────────────────────────────────────────

  async function handleRejectTransfer(t) {
    const reason = prompt('Enter rejection reason:')
    if (!reason || !reason.trim()) return
    setRejecting(true)
    try {
      const { error } = await supabase
        .from('material_transfers')
        .update({ status: 'rejected', rejected_by: user?.id, rejected_at: new Date().toISOString(), reject_reason: reason.trim() })
        .eq('id', t.id)
      if (error) throw error
      await notifyUsersAtSite(
        t.from_site,
        'Transfer Rejected',
        `Transfer ${t.transfer_no} (GP: ${t.gate_pass_no || ''}) rejected: ${reason.trim()}`,
        '/materials',
        'transfer_material'
      )
      setDetailTransfer(null)
      await fetchTransfers()
      onRefresh()
    } catch (err) {
      console.error('Reject transfer error:', err)
      alert('Failed to reject: ' + (err.message || err))
    } finally {
      setRejecting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

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
        <div className="mat-subtab-bar" style={{ gap: 4 }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'confirmed', label: 'Confirmed' },
            { key: 'rejected', label: 'Rejected' },
          ].map(f => (
            <button key={f.key}
              className={statusFilter === f.key ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '4px 12px', borderRadius: 20 }}
              onClick={() => setStatusFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <Plus size={15} /> New Transfer / Gate Pass
        </button>
      </div>

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'var(--red-dim)', borderBottom:'1px solid var(--status-danger-soft)' }}>
          <span style={{ color:'var(--red)', }}>{selectedIds.size} transfer{selectedIds.size > 1 ? 's' : ''} selected</span>
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

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, color: 'var(--text-3)' }}>
          <Loader2 size={22} className="spin" style={{ marginRight: 8 }} /> Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-3)' }}>
          <ArrowLeftRight size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ textTransform: 'uppercase', marginBottom: 4 }}>
            {search || statusFilter !== 'all' ? 'No matching transfers' : 'No transfers yet'}
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
                  <th style={{ width:36 }}><input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} style={{ cursor:'pointer' }}/></th>
                  <th>Date</th>
                  <th>Gate Pass No</th>
                  <th>Type</th>
                  <th>From Site</th>
                  <th>To Site</th>
                  <th>Purpose</th>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th>Initiated By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const initiator = t.initiator || {}
                  return (
                    <tr key={t.id} style={{ background: selectedIds.has(t.id) ? 'var(--status-danger-soft)' : undefined }}>
                      <td><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleOne(t.id)} style={{ cursor:'pointer' }}/></td>
                      <td style={{ whiteSpace: 'nowrap', }}>{fmtDate(t.created_at)}</td>
                      <td>
                        <div style={{ color: 'var(--accent)', }}>{t.gate_pass_no || '-'}</div>
                        <div style={{ color: 'var(--text-3)' }}>{t.transfer_no}</div>
                      </td>
                      <td><PassTypeBadge type={t.pass_type} /></td>
                      <td >{t.from_site || '-'}</td>
                      <td >{t.to_site || '-'}</td>
                      <td style={{ color: 'var(--text-2)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.purpose || '-'}</td>
                      <td style={{ color: 'var(--text-2)' }}>{t.vehicle_no || '-'}</td>
                      <td><StatusBadge status={t.status} /></td>
                      <td >{initiator.full_name || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button className="btn-ghost" title="View Details" onClick={() => openDetail(t)} style={{ padding: '4px 6px', borderRadius: 6 }}>
                            <Eye size={15} />
                          </button>
                          <button className="btn-ghost" title="Print Gate Pass" onClick={() => handlePrintGatePass(t)} style={{ padding: '4px 6px', borderRadius: 6, color: 'var(--accent)' }}>
                            <Printer size={15} />
                          </button>
                          {t.status === 'pending' && (
                            <>
                              <button className="btn-ghost" title="Confirm" onClick={() => handleConfirmTransfer(t)} style={{ padding: '4px 6px', borderRadius: 6, color: 'var(--green)' }}>
                                <CheckCircle2 size={15} />
                              </button>
                              <button className="btn-ghost" title="Reject" onClick={() => handleRejectTransfer(t)} style={{ padding: '4px 6px', borderRadius: 6, color: 'var(--red)' }}>
                                <XCircle size={15} />
                              </button>
                            </>
                          )}
                          <button title="Delete" onClick={() => handleBulkDelete([t.id])}
                            style={{ padding: '4px 6px', borderRadius: 6, background: 'var(--red-dim)',
                              border: '1.5px solid var(--status-danger-soft)', cursor: 'pointer', color: 'var(--red)',
                              display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="mobile-cards" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(t => {
              const initiator = t.initiator || {}
              return (
                <div key={t.id} className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <span style={{ color: 'var(--accent)', }}>{t.gate_pass_no || t.transfer_no}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <PassTypeBadge type={t.pass_type} />
                      <StatusBadge status={t.status} />
                    </div>
                  </div>

                  {t.purpose && <div style={{ marginBottom: 8 }}>{t.purpose}</div>}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginBottom: 12 }}>
                    <div>
                      <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>From Site</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} style={{ color: 'var(--red)' }} />{t.from_site || '-'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>To Site</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} style={{ color: 'var(--green)' }} />{t.to_site || '-'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>Vehicle</div>
                      <div >{t.vehicle_no || '-'}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>By</div>
                      <div>{initiator.full_name || '-'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <button className="btn-ghost" onClick={() => openDetail(t)} style={{ display: 'flex', alignItems: 'center', gap: 4, }}>
                      <Eye size={13} /> Details
                    </button>
                    <button className="btn-ghost" onClick={() => handlePrintGatePass(t)} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)' }}>
                      <Printer size={13} /> Gate Pass
                    </button>
                    {t.status === 'pending' && (
                      <>
                        <button className="btn-ghost" onClick={() => handleConfirmTransfer(t)} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--green)', marginLeft: 'auto' }}>
                          <CheckCircle2 size={13} /> Confirm
                        </button>
                        <button className="btn-ghost" onClick={() => handleRejectTransfer(t)} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--red)' }}>
                          <XCircle size={13} /> Reject
                        </button>
                      </>
                    )}
                    <button onClick={() => handleBulkDelete([t.id])} style={{ marginLeft: t.status !== 'pending' ? 'auto' : undefined,
                      display: 'flex', alignItems: 'center', gap: 4, color: 'var(--red)',
                      padding: '4px 10px', borderRadius: 8, background: 'var(--red-dim)',
                      border: '1.5px solid var(--status-danger-soft)', cursor: 'pointer' }}>
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateTransferModal
          onClose={() => setShowCreate(false)}
          materials={materials}
          stock={stock}
          sites={sites}
          onSubmit={handleCreateTransfer}
        />
      )}

      {/* Detail Modal */}
      {detailTransfer && (
        <TransferDetailModal
          transfer={detailTransfer}
          transferItems={detailItems}
          onClose={() => { setDetailTransfer(null); setDetailItems([]) }}
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


