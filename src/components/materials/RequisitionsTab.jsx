import React, { useState } from 'react'
import { Trash2, Eye, CheckCircle2, XCircle, Truck, PackageCheck, Clock, MapPin, X, Boxes } from 'lucide-react'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

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

const StatusBadge = ({ status }) => {
  const map = {
    pending:    { bg: 'var(--amber-dim)', color: '#c97b00', border: 'rgba(245,158,11,0.25)', icon: Clock },
    approved:   { bg: 'var(--accent-glow)', color: 'var(--accent)', border: 'rgba(79,126,255,0.25)', icon: CheckCircle2 },
    rejected:   { bg: 'var(--red-dim)', color: 'var(--red)', border: 'rgba(239,68,68,0.2)', icon: XCircle },
    dispatched: { bg: 'var(--purple-dim)', color: 'var(--purple)', border: 'rgba(139,92,246,0.25)', icon: Truck },
    received:   { bg: 'var(--green-dim)', color: 'var(--green)', border: 'rgba(0,185,107,0.25)', icon: PackageCheck },
  }
  const m = map[status] || map.pending
  const Icon = m.icon
  return (
    <span className="badge" style={{ background: m.bg, color: m.color, border: `1.5px solid ${m.border}` }}>
      <Icon size={11} />{status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  )
}

export default function RequisitionsTab({ reqs, canWrite, onAction, onView, userId, onBulkDelete }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const filtered = statusFilter === 'all' ? reqs : reqs.filter(r => r.status === statusFilter)
  const toggleOne = id => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAll = () => setSelectedIds(prev => prev.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(r => r.id)))
  const clearSel = () => setSelectedIds(new Set())

  if (!reqs.length) return <EmptyState msg="No requisitions yet. Click 'Request Material' to raise one." />

  return (
    <div>
      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {['all', 'pending', 'approved', 'dispatched', 'received', 'rejected'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); clearSel() }}
            style={{ padding: '5px 14px', borderRadius: 20, border: statusFilter === s ? '2px solid var(--accent)' : '2px solid var(--border)',
              background: statusFilter === s ? 'var(--accent-glow)' : 'var(--bg-2)', color: statusFilter === s ? 'var(--accent)' : 'var(--text-2)',
              fontFamily: 'DM Sans', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s' }}>
            {s === 'all' ? `All (${reqs.length})` : `${s} (${reqs.filter(r => r.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Bulk delete bar */}
      {canWrite && selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--red-dim)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--red)', fontWeight: 600 }}>{selectedIds.size} requisition{selectedIds.size > 1 ? 's' : ''} selected</span>
          <button onClick={() => { onBulkDelete(filtered.filter(r => selectedIds.has(r.id))); clearSel() }}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, background: 'var(--red)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
            <Trash2 size={13} /> Delete Selected
          </button>
          <button onClick={clearSel}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, background: 'var(--bg-3)', border: '1.5px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '0.78rem' }}>
            <X size={13} /> Cancel
          </button>
        </div>
      )}

      {/* Desktop Table */}
      <div className="desktop-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="tbl">
          <thead>
            <tr>
              {canWrite && <th style={{ width: 36 }}><input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} style={{ cursor: 'pointer' }} /></th>}
              <th>Date</th>
              <th>Material</th>
              <th>From</th>
              <th>To</th>
              <th>Qty</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Requested By</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} style={{ background: selectedIds.has(r.id) ? 'rgba(239,68,68,0.04)' : undefined }}>
                {canWrite && <td><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer' }} /></td>}
                <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-2)' }}>
                  {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-0)' }}>{r.materials?.material_name}</td>
                <td><span style={{ fontSize: '0.82rem' }}>{r.from_site}</span></td>
                <td><span style={{ fontSize: '0.82rem' }}>{r.to_site}</span></td>
                <td><span style={{ fontFamily: 'Oswald', fontWeight: 700 }}>{fmt(r.quantity)}</span></td>
                <td>
                  <span className="badge" style={{
                    background: r.priority === 'urgent' ? 'var(--red-dim)' : r.priority === 'high' ? 'var(--amber-dim)' : 'var(--bg-3)',
                    color: r.priority === 'urgent' ? 'var(--red)' : r.priority === 'high' ? '#c97b00' : 'var(--text-2)',
                    border: `1.5px solid ${r.priority === 'urgent' ? 'rgba(239,68,68,0.2)' : r.priority === 'high' ? 'rgba(245,158,11,0.25)' : 'var(--border)'}`,
                  }}>
                    {r.priority || 'normal'}
                  </span>
                </td>
                <td><StatusBadge status={r.status} /></td>
                <td style={{ fontSize: '0.82rem' }}>{r.requester?.full_name || '—'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button onClick={() => onView(r)} title="View Details"
                    style={{ background: 'var(--accent-glow)', border: '1.5px solid rgba(79,126,255,0.2)', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: 'var(--accent)', marginRight: 4 }}>
                    <Eye size={14} />
                  </button>
                  {canWrite && r.status === 'pending' && (
                    <>
                      <button onClick={() => onAction(r, 'approve')} title="Approve"
                        style={{ background: 'var(--green-dim)', border: '1.5px solid rgba(0,185,107,0.2)', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: 'var(--green)', marginRight: 4 }}>
                        <CheckCircle2 size={14} />
                      </button>
                      <button onClick={() => { const reason = prompt('Rejection reason:'); if (reason !== null) onAction(r, 'reject', { reason }) }} title="Reject"
                        style={{ background: 'var(--red-dim)', border: '1.5px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: 'var(--red)' }}>
                        <XCircle size={14} />
                      </button>
                    </>
                  )}
                  {canWrite && r.status === 'approved' && (
                    <button onClick={() => onAction(r, 'dispatch')} title="Dispatch"
                      style={{ background: 'var(--purple-dim)', border: '1.5px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: 'var(--purple)' }}>
                      <Truck size={14} />
                    </button>
                  )}
                  {r.status === 'dispatched' && (r.requested_by === userId || canWrite) && (
                    <button onClick={() => onAction(r, 'receive')} title="Mark Received"
                      style={{ background: 'var(--green-dim)', border: '1.5px solid rgba(0,185,107,0.2)', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: 'var(--green)' }}>
                      <PackageCheck size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="mobile-cards" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(r => (
          <div key={r.id} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <StatusBadge status={r.status} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 6 }}>{r.materials?.material_name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '0.8rem', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginBottom: 1 }}>From</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={11} style={{ color: 'var(--text-3)' }} />{r.from_site}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginBottom: 1 }}>To</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={11} style={{ color: 'var(--green)' }} />{r.to_site}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginBottom: 1 }}>Quantity</div>
                <div style={{ fontFamily: 'Oswald', fontWeight: 700 }}>{fmt(r.quantity)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginBottom: 1 }}>By</div>
                <div>{r.requester?.full_name || '—'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge" style={{
                background: r.priority === 'urgent' ? 'var(--red-dim)' : r.priority === 'high' ? 'var(--amber-dim)' : 'var(--bg-3)',
                color: r.priority === 'urgent' ? 'var(--red)' : r.priority === 'high' ? '#c97b00' : 'var(--text-2)',
              }}>
                {r.priority || 'normal'}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <button onClick={() => onView(r)} className="btn-ghost" style={{ padding: '4px 8px' }}><Eye size={13} /></button>
                {canWrite && r.status === 'pending' && (
                  <>
                    <button onClick={() => onAction(r, 'approve')} style={{ background: 'var(--green-dim)', border: '1.5px solid rgba(0,185,107,0.2)', borderRadius: 10, padding: '4px 8px', cursor: 'pointer', color: 'var(--green)' }}><CheckCircle2 size={13} /></button>
                    <button onClick={() => { const reason = prompt('Rejection reason:'); if (reason !== null) onAction(r, 'reject', { reason }) }} style={{ background: 'var(--red-dim)', border: '1.5px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '4px 8px', cursor: 'pointer', color: 'var(--red)' }}><XCircle size={13} /></button>
                  </>
                )}
                {canWrite && r.status === 'approved' && (
                  <button onClick={() => onAction(r, 'dispatch')} style={{ background: 'var(--purple-dim)', border: '1.5px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '4px 8px', cursor: 'pointer', color: 'var(--purple)' }}><Truck size={13} /></button>
                )}
                {r.status === 'dispatched' && (r.requested_by === userId || canWrite) && (
                  <button onClick={() => onAction(r, 'receive')} style={{ background: 'var(--green-dim)', border: '1.5px solid rgba(0,185,107,0.2)', borderRadius: 10, padding: '4px 8px', cursor: 'pointer', color: 'var(--green)' }}><PackageCheck size={13} /></button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
