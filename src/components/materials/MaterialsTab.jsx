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

export default function MaterialsTab({ materials, stock, canWrite, onEdit, onDelete, onBulkDelete }) {
  const [selectedIds, setSelectedIds] = useState(new Set())
  const toggleOne = id => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAll = () => setSelectedIds(prev => prev.size === materials.length && materials.length > 0 ? new Set() : new Set(materials.map(m => m.id)))
  const clearSel = () => setSelectedIds(new Set())

  if (!materials.length) return <EmptyState msg="No materials added yet. Click 'Add Material' to get started." />
  const totalInvVal = materials.reduce((s, m) => {
    const t = stock.filter(ss => ss.material_id === m.id).reduce((sum, ss) => sum + Number(ss.quantity), 0)
    return s + t * Number(m.unit_cost || 0)
  }, 0)

  return (
    <>
      {/* Bulk delete bar */}
      {canWrite && selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--red-dim)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--red)', fontWeight: 600 }}>{selectedIds.size} material{selectedIds.size > 1 ? 's' : ''} selected</span>
          <button onClick={() => { onBulkDelete(materials.filter(m => selectedIds.has(m.id))); clearSel() }}
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
              {canWrite && <th style={{ width: 36 }}><input type="checkbox" checked={selectedIds.size === materials.length && materials.length > 0} onChange={toggleAll} style={{ cursor: 'pointer' }} /></th>}
              <th>Name</th>
              <th>Code</th>
              <th className="col-hide-mobile">Category</th>
              <th className="col-hide-mobile">Unit</th>
              <th className="col-hide-mobile">Unit Cost</th>
              <th>Total Stock</th>
              <th className="col-hide-mobile">Total Value</th>
              <th className="col-hide-mobile">Sites</th>
              {canWrite && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {materials.map(m => {
              const siteStocks = stock.filter(s => s.material_id === m.id)
              const total = siteStocks.reduce((sum, s) => sum + Number(s.quantity), 0)
              const totalVal = total * Number(m.unit_cost || 0)
              return (
                <tr key={m.id} style={{ background: selectedIds.has(m.id) ? 'rgba(239,68,68,0.04)' : undefined }}>
                  {canWrite && <td><input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleOne(m.id)} style={{ cursor: 'pointer' }} /></td>}
                  <td style={{ fontWeight: 600, color: 'var(--text-0)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {m.material_name}
                      {m.is_reusable && (
                        <span className="badge" style={{ background: 'rgba(6,182,212,0.08)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,0.2)', fontSize: '0.62rem', padding: '1px 6px' }}>
                          <RotateCcw size={9} />Reusable
                        </span>
                      )}
                    </div>
                    {m.description && <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 2 }}>{m.description}</div>}
                  </td>
                  <td><code style={{ fontSize: '0.75rem', background: 'var(--bg-3)', padding: '3px 8px', borderRadius: 8, fontFamily: 'DM Mono', color: 'var(--text-2)', border: '1px solid var(--border)' }}>{m.material_code}</code></td>
                  <td className="col-hide-mobile">{m.category || '—'}</td>
                  <td className="col-hide-mobile">{m.unit}</td>
                  <td className="col-hide-mobile" style={{ fontSize: '0.85rem' }}>{Number(m.unit_cost) > 0 ? fmtCur(m.unit_cost) : <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                  <td><span style={{ fontFamily: 'Oswald', fontWeight: 700, fontSize: '0.95rem', color: total > 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(total)}</span></td>
                  <td className="col-hide-mobile" style={{ fontWeight: 600, fontSize: '0.85rem' }}>{totalVal > 0 ? fmtCur(totalVal) : '—'}</td>
                  <td className="col-hide-mobile">
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {siteStocks.filter(s => Number(s.quantity) > 0).map(s => (
                        <span key={s.site} style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-2)', border: '1px solid var(--border)', fontFamily: 'DM Sans', whiteSpace: 'nowrap' }}>{s.site}: {fmt(s.quantity)}</span>
                      ))}
                      {siteStocks.filter(s => Number(s.quantity) > 0).length === 0 && <span style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>No stock</span>}
                    </div>
                  </td>
                  {canWrite && (
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => onEdit(m)} title="Edit" style={{ background: 'var(--accent-glow)', border: '1.5px solid rgba(79,126,255,0.2)', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: 'var(--accent)', marginRight: 6 }}><Pencil size={14} /></button>
                      <button onClick={() => onDelete(m.id)} title="Delete" style={{ background: 'var(--red-dim)', border: '1.5px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: 'var(--red)' }}><Trash2 size={14} /></button>
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
        {materials.map(m => {
          const siteStocks = stock.filter(s => s.material_id === m.id)
          const total = siteStocks.reduce((sum, s) => sum + Number(s.quantity), 0)
          const totalVal = total * Number(m.unit_cost || 0)
          return (
            <div key={m.id} className="mat-mobile-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="mat-mobile-title">
                    {m.material_name}
                    {m.is_reusable && (
                      <span className="badge" style={{ marginLeft: 6, background: 'rgba(6,182,212,0.08)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,0.2)', fontSize: '0.65rem', padding: '1px 5px', verticalAlign: 'middle' }}>
                        <RotateCcw size={8} />Reusable
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                    <span className="mat-mobile-code">{m.material_code}</span>
                    {m.category && <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{m.category}</span>}
                  </div>
                </div>
                <span style={{ fontFamily: 'Oswald', fontWeight: 700, fontSize: '1.05rem', color: total > 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(total)}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {Number(m.unit_cost) > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{fmtCur(m.unit_cost)}/{m.unit}</span>}
                {totalVal > 0 && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)' }}>Value: {fmtCur(totalVal)}</span>}
              </div>
              {siteStocks.filter(s => Number(s.quantity) > 0).length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {siteStocks.filter(s => Number(s.quantity) > 0).map(s => (
                    <span key={s.site} style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-2)', border: '1px solid var(--border)', fontFamily: 'DM Sans' }}>{s.site}: {fmt(s.quantity)}</span>
                  ))}
                </div>
              )}
              {canWrite && (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button onClick={() => onEdit(m)} className="btn-ghost" style={{ padding: '5px 12px', fontSize: '0.75rem' }}><Pencil size={12} />Edit</button>
                  <button onClick={() => onDelete(m.id)} className="btn-danger" style={{ padding: '5px 12px', fontSize: '0.75rem' }}><Trash2 size={12} />Delete</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Total valuation footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 20px', borderTop: '2px solid var(--border)', background: 'var(--bg-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Oswald', fontSize: '0.78rem', color: 'var(--text-2)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Total Value:</span>
          <span style={{ fontFamily: 'DM Sans', fontWeight: 700, fontSize: '1rem', color: 'var(--green)' }}>{fmtCur(totalInvVal)}</span>
        </div>
      </div>
    </>
  )
}
