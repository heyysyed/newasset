import { writePrintDocument } from '../../lib/printDocument'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus, Search, Loader2, Printer, Package,
  MapPin, User, FileText, AlertTriangle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ModalShell from './ModalShell'

// ── Print Issue Slip ───────────────────────────────────────────────────────────

function printSlip(slip) {
  const item = slip.bulk_items || {}
  const issuer = slip.issuer || {}
  const date = new Date(slip.created_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  const html = `
<!DOCTYPE html>
<html><head><title>Issue Slip - ${slip.slip_no}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { padding: 40px; color: #1a1a1a; }
  .header { text-align: center; margin-bottom: 28px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
  .header h1 { font-size: 18px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
  .header h2 { font-size: 14px; font-weight: 400; color: #555; }
  .slip-meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
  .slip-meta strong { font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; font-size: 13px; }
  th { background: #f5f5f5; font-weight: 600; width: 35%; }
  .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
  .sig-block { text-align: center; width: 40%; }
  .sig-line { border-top: 1px solid #1a1a1a; margin-top: 50px; padding-top: 6px; font-size: 13px; font-weight: 600; }
  @media print { body { padding: 20px; } }
</style>
</head><body>
  <div class="header">
    <h1>Strongbuilt Constructions Pvt. Ltd.</h1>
    <h2>Material Issue Slip</h2>
  </div>
  <div class="slip-meta">
    <div><strong>Slip No:</strong> ${slip.slip_no}</div>
    <div><strong>Date:</strong> ${date}</div>
  </div>
  <table>
    <tr><th>Item Name</th><td>${item.item_name || '-'}</td></tr>
    <tr><th>Item Code</th><td>${item.item_code || '-'}</td></tr>
    <tr><th>Unit</th><td>${item.unit || '-'}</td></tr>
    <tr><th>Quantity Issued</th><td>${slip.quantity}</td></tr>
    <tr><th>Site</th><td>${slip.site || '-'}</td></tr>
    <tr><th>Issued To</th><td>${slip.issued_to || '-'}</td></tr>
    <tr><th>Role</th><td>${slip.issued_to_role || '-'}</td></tr>
    <tr><th>Purpose</th><td>${slip.purpose || '-'}</td></tr>
    ${slip.notes ? `<tr><th>Notes</th><td>${slip.notes}</td></tr>` : ''}
  </table>
  <div class="signatures">
    <div class="sig-block">
      <div class="sig-line">Issued By${issuer.full_name ? ` (${issuer.full_name})` : ''}</div>
    </div>
    <div class="sig-block">
      <div class="sig-line">Received By${slip.issued_to ? ` (${slip.issued_to})` : ''}</div>
    </div>
  </div>
</body></html>`

  const win = window.open('', '_blank', 'width=800,height=600'); if (!win) { alert('Allow pop-ups to open the print preview.'); return }
  if (win) {
    writePrintDocument(win, html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }
}

// ── Create Issue Slip Modal ────────────────────────────────────────────────────

function CreateSlipModal({ items, stock, sites, userId, onClose, onSaved }) {
  const [itemId, setItemId] = useState('')
  const [site, setSite] = useState('')
  const [quantity, setQuantity] = useState('')
  const [issuedTo, setIssuedTo] = useState('')
  const [role, setRole] = useState('')
  const [purpose, setPurpose] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Sites that have stock for the selected item
  const availableSites = useMemo(() => {
    if (!itemId) return []
    return stock
      .filter(s => s.item_id === itemId && s.usable_qty > 0)
      .map(s => s.site)
      .filter(s => sites.includes(s))
  }, [itemId, stock, sites])

  // Current available qty at selected site
  const availableQty = useMemo(() => {
    if (!itemId || !site) return 0
    const entry = stock.find(s => s.item_id === itemId && s.site === site)
    return entry ? Number(entry.usable_qty) : 0
  }, [itemId, site, stock])

  // Selected item details
  const selectedItem = useMemo(
    () => items.find(m => m.id === itemId),
    [itemId, items],
  )

  // Reset site when item changes
  useEffect(() => { setSite('') }, [itemId])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const qty = Number(quantity)
    if (!itemId) return setError('Please select an item.')
    if (!site) return setError('Please select a site.')
    if (!qty || qty <= 0) return setError('Quantity must be greater than 0.')
    if (qty > availableQty) return setError(`Insufficient stock. Available: ${availableQty}`)
    if (!issuedTo.trim()) return setError('Please enter "Issued To" name.')

    setSaving(true)
    try {
      // Generate slip number: ISS-YYYYMMDD-NNN
      const today = new Date()
      const datePart = today.toISOString().slice(0, 10).replace(/-/g, '')
      const { count, error: countErr } = await supabase
        .from('inventory_issue_slips')
        .select('id', { count: 'exact', head: true })
      if (countErr) throw countErr
      const slipNo = `ISS-${datePart}-${String((count || 0) + 1).padStart(3, '0')}`

      // 1. Deduct stock (from usable_qty)
      const stockRow = stock.find(s => s.item_id === itemId && s.site === site)
      if (!stockRow) throw new Error('Stock record not found.')
      const newQty = Number(stockRow.usable_qty) - qty
      if (newQty < 0) throw new Error('Insufficient stock.')

      const { error: stockErr } = await supabase
        .from('bulk_site_stock')
        .update({ usable_qty: newQty, updated_at: new Date().toISOString() })
        .eq('id', stockRow.id)
      if (stockErr) throw stockErr

      // 2. Insert issue slip
      const { error: slipErr } = await supabase
        .from('inventory_issue_slips')
        .insert({
          slip_no: slipNo,
          item_id: itemId,
          site,
          quantity: qty,
          issued_to: issuedTo.trim(),
          issued_to_role: role.trim() || null,
          purpose: purpose.trim() || null,
          notes: notes.trim() || null,
          issued_by: userId,
        })
      if (slipErr) throw slipErr

      // 3. Insert transaction log
      const { error: txErr } = await supabase
        .from('bulk_transactions')
        .insert({
          item_id: itemId,
          transaction_type: 'issue',
          from_site: site,
          to_site: issuedTo.trim() || 'Issued',
          quantity: qty,
          notes: `Issue slip ${slipNo} - ${purpose || 'N/A'}`.slice(0, 500),
          performed_by: userId,
        })
      if (txErr) throw txErr

      onSaved()
    } catch (err) {
      console.error('Issue slip error:', err)
      setError(err.message || 'Failed to create issue slip.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell onClose={onClose} accent="var(--accent)">
      <h3 style={{ marginBottom: 18, paddingRight: 32 }}>
        New Issue Slip
      </h3>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Item */}
        <div>
          <label className="lbl" style={{ marginBottom: 4, display: 'block' }}>
            Item *
          </label>
          <select className="sel" value={itemId} onChange={e => setItemId(e.target.value)} required
            style={{ height: 38, }}>
            <option value="">Select item...</option>
            {items.map(m => (
              <option key={m.id} value={m.id}>
                {m.item_code} - {m.item_name} ({m.unit})
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
            disabled={!itemId} style={{ height: 38, }}>
            <option value="">{itemId ? 'Select site...' : 'Select an item first'}</option>
            {availableSites.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {itemId && availableSites.length === 0 && (
            <div style={{ marginTop: 4, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={12} /> No sites have stock for this item
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
              {availableQty} {selectedItem?.unit || ''}
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

        {/* Issued To + Role */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="lbl" style={{ marginBottom: 4, display: 'block' }}>
              Issued To *
            </label>
            <input className="inp" value={issuedTo} onChange={e => setIssuedTo(e.target.value)} required
              placeholder="Person / Contractor" style={{ height: 38, }} />
          </div>
          <div>
            <label className="lbl" style={{ marginBottom: 4, display: 'block' }}>
              Role
            </label>
            <input className="inp" value={role} onChange={e => setRole(e.target.value)}
              placeholder="e.g. Contractor" style={{ height: 38, }} />
          </div>
        </div>

        {/* Purpose */}
        <div>
          <label className="lbl" style={{ marginBottom: 4, display: 'block' }}>
            Purpose
          </label>
          <input className="inp" value={purpose} onChange={e => setPurpose(e.target.value)}
            placeholder="What is the material for?" style={{ height: 38, }} />
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
          {saving ? <><Loader2 size={16} className="spin" /> Creating...</> : <><FileText size={16} /> Create Issue Slip</>}
        </button>
      </form>
    </ModalShell>
  )
}

// ── Main Tab Component ─────────────────────────────────────────────────────────

export default function IssueSlipTab({ items, stock, sites, onRefresh }) {
  const { user } = useAuth()

  const [slips, setSlips] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  // ── Fetch slips ──────────────────────────────────────────────────────────────

  const fetchSlips = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_issue_slips')
        .select('*, bulk_items(item_name, item_code, unit)')
        .order('created_at', { ascending: false })
      if (error) throw error

      // Fetch issuer names separately
      if (data?.length) {
        const userIds = [...new Set(data.map(s => s.issued_by).filter(Boolean))]
        if (userIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
          const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]))
          for (const s of data) {
            s.issuer = { full_name: profileMap[s.issued_by] || null }
          }
        }
      }
      setSlips(data || [])
    } catch (err) {
      console.error('Failed to fetch issue slips:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSlips() }, [fetchSlips])

  // ── Filtered list ────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search) return slips
    const q = search.toLowerCase()
    return slips.filter(s =>
      s.bulk_items?.item_name?.toLowerCase().includes(q) ||
      s.issued_to?.toLowerCase().includes(q) ||
      s.purpose?.toLowerCase().includes(q) ||
      s.slip_no?.toLowerCase().includes(q)
    )
  }, [slips, search])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Top bar */}
      <div className="mat-subtab-bar">
        <div style={{ position: 'relative', flex: 1, minWidth: 150 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          <input className="inp" placeholder="Search slips..." style={{ paddingLeft: 34 }}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={14} /> <span className="btn-label">New Issue Slip</span>
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
          <Loader2 size={24} className="spin" style={{ margin: '0 auto 12px' }} />
          <div >Loading issue slips...</div>
        </div>
      )}

      {/* Desktop Table */}
      {!loading && (
        <div className="card desktop-table" style={{ overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl" style={{ minWidth: 950 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Slip No</th>
                  <th>Item</th>
                  <th>Site</th>
                  <th>Qty</th>
                  <th>Issued To</th>
                  <th>Purpose</th>
                  <th>Issued By</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(slip => (
                  <tr key={slip.id}>
                    <td>
                      <span style={{ color: 'var(--text-2)', }}>
                        {new Date(slip.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--accent)' }}>
                        {slip.slip_no}
                      </span>
                    </td>
                    <td>
                      <div style={{ color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        {slip.bulk_items?.item_name || '-'}
                      </div>
                      <div style={{ color: 'var(--text-3)', }}>
                        {slip.bulk_items?.item_code || ''}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {slip.site || '-'}
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-0)' }}>
                        {slip.quantity}
                      </span>
                      <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>
                        {slip.bulk_items?.unit || ''}
                      </span>
                    </td>
                    <td>
                      <div style={{ color: 'var(--text-0)', }}>
                        {slip.issued_to || '-'}
                      </div>
                      {slip.issued_to_role && (
                        <div style={{ color: 'var(--text-3)' }}>
                          {slip.issued_to_role}
                        </div>
                      )}
                    </td>
                    <td style={{
                      color: 'var(--text-2)', maxWidth: 180,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {slip.purpose || '-'}
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {slip.issuer?.full_name || '-'}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => printSlip(slip)} className="btn-ghost"
                        style={{ padding: 6, marginRight: 4 }} title="Print Slip">
                        <Printer size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
                      {search ? 'No matching issue slips found.' : 'No issue slips yet.'}
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
          {filtered.map(slip => (
            <div
              key={slip.id}
              style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14,
                padding: '14px 16px', borderLeft: '3px solid var(--accent)',
              }}
            >
              {/* Row 1: Slip No + Date + Print */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: 'var(--accent)' }}>
                  {slip.slip_no}
                </span>
                <span style={{ color: 'var(--text-3)' }}>
                  {new Date(slip.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
                <button
                  onClick={() => printSlip(slip)}
                  className="btn-ghost"
                  style={{ marginLeft: 'auto', padding: 4 }}
                  title="Print"
                >
                  <Printer size={13} />
                </button>
              </div>

              {/* Row 2: Item + Qty */}
              <div style={{ color: 'var(--text-0)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {slip.bulk_items?.item_name || '-'}
                <span style={{ color: 'var(--accent)', marginLeft: 'auto' }}>
                  {slip.quantity} {slip.bulk_items?.unit || ''}
                </span>
              </div>

              {/* Row 3: Site + Issued To */}
              <div style={{ display: 'flex', gap: 10, color: 'var(--text-3)', marginBottom: 4, flexWrap: 'wrap' }}>
                {slip.site && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <MapPin size={10} /> {slip.site}
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <User size={10} /> {slip.issued_to || '-'}
                  {slip.issued_to_role ? ` (${slip.issued_to_role})` : ''}
                </span>
              </div>

              {/* Row 4: Purpose */}
              {slip.purpose && (
                <div style={{
                  color: 'var(--text-2)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {slip.purpose}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)', }}>
              <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              {search ? 'No matching issue slips found.' : 'No issue slips yet.'}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateSlipModal
          items={items}
          stock={stock}
          sites={sites}
          userId={user?.id}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false)
            fetchSlips()
            onRefresh()
          }}
        />
      )}
    </div>
  )
}


