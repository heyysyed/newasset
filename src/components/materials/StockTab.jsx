import React, { useState } from 'react'
import { Trash2, Pencil, X, RotateCcw, MapPin, Boxes } from 'lucide-react'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const fmtCur = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function EmptyState({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ 
        width: 56, 
        height: 56, 
        borderRadius: 16, 
        background: 'var(--bg-3)',
        display: 'inline-flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: 14,
        boxShadow: 'var(--clay-inset)' 
      }}>
        <Boxes size={26} style={{ color: 'var(--text-3)' }} />
      </div>
      <p style={{ fontFamily: 'DM Sans', color: 'var(--text-3)', fontSize: '0.88rem' }}>{msg}</p>
    </div>
  )
}

function StockHealth({ qty, reorder }) {
  const q = Number(qty)
  const r = Number(reorder)
  if (r <= 0) return <span style={{ fontFamily: 'Oswald', fontWeight: 700, fontSize: '0.95rem', color: 'var(--green)' }}>{fmt(q)}</span>
  const ratio = q / r
  let color = 'var(--green)'
  let label = 'Healthy'
  if (q <= 0) { 
    color = 'var(--red)'
    label = 'Out of Stock' 
  } else if (ratio <= 1) { 
    color = 'var(--red)'
    label = 'Critical' 
  } else if (ratio <= 2) { 
    color = 'var(--amber)'
    label = 'Low' 
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: 'Oswald', fontWeight: 700, fontSize: '0.95rem', color }}>{fmt(q)}</span>
      {r > 0 && (
        <span style={{ 
          fontSize: '0.65rem', 
          padding: '2px 6px', 
          borderRadius: 6, 
          fontWeight: 600, 
          fontFamily: 'DM Sans',
          background: color === 'var(--green)' ? 'var(--green-dim)' : color === 'var(--amber)' ? 'var(--amber-dim)' : 'var(--red-dim)',
          color 
        }}>{label}</span>
      )}
    </div>
  )
}

export default function StockTab({ rows, canWrite, onEditReorder, onDeleteStock, onBulkDelete }) {
  const [selectedIds, setSelectedIds] = useState(new Set())
  const toggleOne = id => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAll = () => setSelectedIds(prev => prev.size === rows.length && rows.length > 0 ? new Set() : new Set(rows.map(r => r.id)))
  const clearSel = () => setSelectedIds(new Set())

  if (!rows.length) return <EmptyState msg="No stock records found" />
  const totalVal = rows.reduce((s, r) => s + Number(r.quantity) * Number(r.materials?.unit_cost || 0), 0)

  return (
    <>
      {/* Bulk delete bar */}
      {canWrite && selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--red-dim)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--red)', fontWeight: 600 }}>{selectedIds.size} record{selectedIds.size > 1 ? 's' : ''} selected</span>
          <button onClick={() => { onBulkDelete(rows.filter(r => selectedIds.has(r.id))); clearSel() }}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, background: 'var(--red)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
            <Trash2 size={13} /> Delete Selected
          </button>
          <button onClick={clearSel}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, background: 'var(--bg-3)', border: '1.5px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '0.78rem' }}>
            <X size={13} /> Cancel
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="desktop-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="tbl">
          <thead>
            <tr>
              {canWrite && <th style={{ width: 36 }}><input type="checkbox" checked={selectedIds.size === rows.length && rows.length > 0} onChange={toggleAll} style={{ cursor: 'pointer' }} /></th>}
              <th>Material</th>
              <th>Code</th>
              <th>Site</th>
              <th>Quantity</th>
              <th className="col-hide-mobile">Reorder Level</th>
              <th className="col-hide-mobile">Unit Cost</th>
              <th className="col-hide-mobile">Value</th>
              {canWrite && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const cost = Number(r.materials?.unit_cost || 0)
              const val = Number(r.quantity) * cost
              return (
                <tr key={r.id} style={{ background: selectedIds.has(r.id) ? 'rgba(239,68,68,0.04)' : undefined }}>
                  {canWrite && <td><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer' }} /></td>}
                  <td style={{ fontWeight: 600, color: 'var(--text-0)' }}>
                    {r.materials?.material_name}
                    {r.materials?.is_reusable && (
                      <span className="badge" style={{ marginLeft: 6, background: 'rgba(6,182,212,0.08)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,0.2)', fontSize: '0.62rem', padding: '1px 6px' }}>
                        <RotateCcw size={9} />Reusable
                      </span>
                    )}
                  </td>
                  <td>
                    <code style={{ fontSize: '0.75rem', background: 'var(--bg-3)', padding: '3px 8px', borderRadius: 8, fontFamily: 'DM Mono', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                      {r.materials?.material_code}
                    </code>
                  </td>
                  <td>
                    <span className="badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1.5px solid rgba(79,126,255,0.25)' }}>
                      <MapPin size={11} />{r.site}
                    </span>
                  </td>
                  <td><StockHealth qty={r.quantity} reorder={r.reorder_level} /></td>
                  <td className="col-hide-mobile" style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>
                    {Number(r.reorder_level) > 0 ? fmt(r.reorder_level) : <span style={{ color: 'var(--text-3)' }}>Not set</span>}
                  </td>
                  <td className="col-hide-mobile" style={{ fontSize: '0.85rem' }}>{cost > 0 ? fmtCur(cost) : <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                  <td className="col-hide-mobile" style={{ fontWeight: 600, fontSize: '0.85rem' }}>{val > 0 ? fmtCur(val) : '—'}</td>
                  {canWrite && (
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => onEditReorder(r)} title="Set Reorder Level"
                        style={{ background: 'var(--accent-glow)', border: '1.5px solid rgba(79,126,255,0.2)', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: 'var(--accent)', transition: 'all 0.15s', marginRight: 4 }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => onDeleteStock(r)} title="Delete Stock"
                        style={{ background: 'var(--red-dim)', border: '1.5px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: 'var(--red)', transition: 'all 0.15s' }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mobile-cards">
        {rows.map(r => {
          const cost = Number(r.materials?.unit_cost || 0)
          const val = Number(r.quantity) * cost
          return (
            <div key={r.id} className="mat-mobile-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="mat-mobile-title">
                    {r.materials?.material_name}
                    {r.materials?.is_reusable && (
                      <span className="badge" style={{ marginLeft: 6, background: 'rgba(6,182,212,0.08)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,0.2)', fontSize: '0.6rem', padding: '1px 5px', verticalAlign: 'middle' }}>
                        <RotateCcw size={8} />Reusable
                      </span>
                    )}
                  </div>
                  <span className="mat-mobile-code">{r.materials?.material_code}</span>
                </div>
                <StockHealth qty={r.quantity} reorder={r.reorder_level} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1.5px solid rgba(79,126,255,0.25)' }}>
                  <MapPin size={10} />{r.site}
                </span>
                {cost > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontFamily: 'DM Sans' }}>{fmtCur(cost)}/unit</span>}
                {val > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--green)', fontFamily: 'DM Sans' }}>{fmtCur(val)}</span>}
              </div>
              {canWrite && (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button onClick={() => onEditReorder(r)} className="btn-ghost" style={{ padding: '5px 12px', fontSize: '0.75rem' }}>
                    <Pencil size={12} />Set Reorder
                  </button>
                  <button onClick={() => onDeleteStock(r)} className="btn-danger" style={{ padding: '5px 12px', fontSize: '0.75rem' }}>
                    <Trash2 size={12} />Delete
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Valuation footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 20px', borderTop: '2px solid var(--border)', background: 'var(--bg-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Oswald', fontSize: '0.78rem', color: 'var(--text-2)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Total Value:
          </span>
          <span style={{ fontFamily: 'DM Sans', fontWeight: 700, fontSize: '1rem', color: 'var(--green)' }}>
            {fmtCur(totalVal)}
          </span>
        </div>
      </div>
    </>
  )
}
