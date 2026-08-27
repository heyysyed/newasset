import React, { useState } from 'react'
import { Trash2, ShoppingCart, ArrowRightLeft, ClipboardList, History, ArrowUpRight, ArrowDownLeft, X, Boxes } from 'lucide-react'

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
      <p style={{ color: 'var(--text-3)', }}>{msg}</p>
    </div>
  )
}

const TxBadge = ({ type }) => {
  const map = {
    purchase:     { bg: 'var(--green-dim)', color: 'var(--green)', border: 'rgba(0,185,107,0.25)', icon: ShoppingCart },
    transfer:     { bg: 'var(--accent-glow)', color: 'var(--accent)', border: 'var(--accent-soft)', icon: ArrowRightLeft },
    requisition:  { bg: 'var(--purple-dim)', color: 'var(--purple)', border: 'rgba(139,92,246,0.25)', icon: ClipboardList },
  }
  const m = map[type] || { bg: 'var(--bg-3)', color: 'var(--text-2)', border: 'var(--border)', icon: History }
  const Icon = m.icon
  return (
    <span className="badge" style={{ background: m.bg, color: m.color, border: `1.5px solid ${m.border}` }}>
      <Icon size={11} />{type?.charAt(0).toUpperCase() + type?.slice(1)}
    </span>
  )
}

export default function HistoryTab({ txns, canWrite, onBulkDelete }) {
  const [selectedIds, setSelectedIds] = useState(new Set())
  const toggleOne = id => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAll = () => setSelectedIds(prev => prev.size === txns.length && txns.length > 0 ? new Set() : new Set(txns.map(t => t.id)))
  const clearSel = () => setSelectedIds(new Set())

  if (!txns.length) return <EmptyState msg="No transactions recorded yet" />

  return (
    <>
      {/* Bulk delete bar */}
      {canWrite && selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--red-dim)', borderBottom: '1px solid var(--status-danger-soft)' }}>
          <span style={{ color: 'var(--red)', }}>{selectedIds.size} record{selectedIds.size > 1 ? 's' : ''} selected</span>
          <button onClick={() => { onBulkDelete(txns.filter(t => selectedIds.has(t.id))); clearSel() }}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, background: 'var(--red)', border: 'none', color: 'white', cursor: 'pointer', }}>
            <Trash2 size={13} /> Delete Selected
          </button>
          <button onClick={clearSel}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, background: 'var(--bg-3)', border: '1.5px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', }}>
            <X size={13} /> Cancel
          </button>
        </div>
      )}

      {/* Desktop */}
      <div className="desktop-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="tbl">
          <thead>
            <tr>
              {canWrite && <th style={{ width: 36 }}><input type="checkbox" checked={selectedIds.size === txns.length && txns.length > 0} onChange={toggleAll} style={{ cursor: 'pointer' }} /></th>}
              <th>Date</th>
              <th>Material</th>
              <th>Type</th>
              <th>From</th>
              <th>To</th>
              <th>Qty</th>
              <th className="col-hide-mobile">Unit Cost</th>
              <th className="col-hide-mobile">By</th>
              <th className="col-hide-mobile">Notes</th>
            </tr>
          </thead>
          <tbody>
            {txns.map(t => (
              <tr key={t.id} style={{ background: selectedIds.has(t.id) ? 'var(--status-danger-soft)' : undefined }}>
                {canWrite && <td><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleOne(t.id)} style={{ cursor: 'pointer' }} /></td>}
                <td style={{ whiteSpace: 'nowrap', color: 'var(--text-2)' }}>
                  {new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ color: 'var(--text-0)' }}>{t.materials?.material_name}</td>
                <td><TxBadge type={t.transaction_type} /></td>
                <td>
                  {t.from_site
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, }}>
                        <ArrowUpRight size={12} style={{ color: 'var(--red)' }} />{t.from_site}
                      </span>
                    : <span style={{ color: 'var(--text-3)' }}>-</span>}
                </td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, }}>
                    <ArrowDownLeft size={12} style={{ color: 'var(--green)' }} />{t.to_site}
                  </span>
                </td>
                <td><span style={{ color: 'var(--text-0)' }}>{fmt(t.quantity)}</span></td>
                <td className="col-hide-mobile" >{Number(t.unit_cost) > 0 ? fmtCur(t.unit_cost) : '-'}</td>
                <td className="col-hide-mobile" >{t.performer?.full_name || '-'}</td>
                <td className="col-hide-mobile" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-3)', }}>{t.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="mobile-cards">
        {txns.map(t => (
          <div key={t.id} className="mat-history-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="mat-mobile-title">{t.materials?.material_name}</div>
                <div style={{ color: 'var(--text-3)', marginTop: 2 }}>
                  {new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {t.performer?.full_name && <span> · {t.performer.full_name}</span>}
                </div>
              </div>
              <span style={{ color: 'var(--text-0)' }}>{fmt(t.quantity)}</span>
            </div>
            <div className="mat-mobile-meta">
              <TxBadge type={t.transaction_type} />
              {t.from_site && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--text-2)' }}>
                  <ArrowUpRight size={11} style={{ color: 'var(--red)' }} />{t.from_site}
                </span>
              )}
              {t.to_site && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--text-2)' }}>
                  <ArrowDownLeft size={11} style={{ color: 'var(--green)' }} />{t.to_site}
                </span>
              )}
              {Number(t.unit_cost) > 0 && <span style={{ color: 'var(--text-2)' }}>{fmtCur(t.unit_cost)}</span>}
            </div>
            {t.notes && <div style={{ color: 'var(--text-3)' }}>{t.notes}</div>}
          </div>
        ))}
      </div>
    </>
  )
}


