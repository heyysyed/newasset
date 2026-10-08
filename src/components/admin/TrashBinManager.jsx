import React, { useState } from 'react'
import { Archive, Trash2, RotateCcw, RefreshCw, Clock, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '../../lib/depreciation'

function PackageIcon(props) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><svg xmlns="http://www.w3.org/2000/svg" width={props.size||16} height={props.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg></span>
}

export default function TrashBinManager({
  deletedAssets,
  trashLoading,
  restoring,
  handleRestore
}) {

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Archive size={16} style={{ color: 'var(--text-3)' }} />
          <div>
            <h3 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Deleted Assets Archive & Recovery</h3>
            <span style={{ color: 'var(--text-3)' }}>Archived assets retain their related records. This archive is separate from disaster-recovery backups.</span>
          </div>
        </div>

        <span>Archived records are retained until an administrator-approved retention process is configured. {deletedAssets.length} items.</span>
      </div>

      {trashLoading ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ width: 24, height: 24, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : deletedAssets.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
          <Trash2 size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p >Trash is empty. Deleted assets will appear here.</p>
        </div>
      ) : (
        <div>
          {deletedAssets.map((d, idx) => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
              borderBottom: idx < deletedAssets.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PackageIcon size={15} style={{ color: 'var(--red)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-0)' }}>{d.asset_name || 'Unnamed'}</span>
                  <span style={{ color: 'var(--accent)', background: 'var(--accent-glow)', padding: '1px 6px', borderRadius: 4 }}>{d.asset_code}</span>
                  {d.category && <span style={{ color: 'var(--text-3)', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 4 }}>{d.category}</span>}
                </div>
                <div style={{ display: 'flex', gap: 12, color: 'var(--text-3)', marginTop: 3, flexWrap: 'wrap' }}>
                  {d.site && <span>Site: {d.site}</span>}
                  {d.purchase_value && <span >{formatCurrency(d.purchase_value)}</span>}
                  <span>Deleted {new Date(d.deleted_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => handleRestore(d.id)} disabled={restoring[d.id]}
                  className="btn-primary" style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 5, background: 'var(--green)', borderColor: 'var(--green)' }}>
                  {restoring[d.id] ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RotateCcw size={12} />} Restore
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


