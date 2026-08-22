import React from 'react'
import { ClipboardList, Plus, Edit2, Trash2, Send } from 'lucide-react'
import { SectionCard, EmptyState } from '../../pages/AssetDetail'

export default function AssetAuditTab({ audit }) {
  if (!audit) return null
  
  const actionConfig = {
    created: { color: 'var(--green)', bg: 'var(--green-dim)', icon: Plus, label: 'Created' },
    updated: { color: 'var(--amber)', bg: 'var(--amber-dim)', icon: Edit2, label: 'Updated' },
    deleted: { color: 'var(--red)', bg: 'var(--red-dim)', icon: Trash2, label: 'Deleted' },
    transferred: { color: 'var(--cyan)', bg: 'var(--cyan-dim)', icon: Send, label: 'Transferred' },
  }
  
  return (
    <SectionCard title={`Audit Trail (${audit.length})`} icon={ClipboardList} noPad accentColor="var(--purple)">
      {audit.length > 0 ? (
        <div>
          {audit.map((log, idx) => {
            const cfg = actionConfig[log.action] || actionConfig.updated
            const ActionIcon = cfg.icon
            return (
              <div key={log.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                borderBottom: idx < audit.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: cfg.bg, color: cfg.color, flexShrink: 0,
                }}>
                  <ActionIcon size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-0)', }}>{log.profiles?.full_name || 'System'}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6,
                      background: cfg.bg, color: cfg.color, textTransform: 'uppercase',
                    }}>{cfg.label}</span>
                  </div>
                  {log.changes && (
                    <p style={{ color: 'var(--text-3)', margin: '4px 0 0', }}>
                      {typeof log.changes === 'string' ? log.changes : JSON.stringify(log.changes)}
                    </p>
                  )}
                </div>
                <span style={{ color: 'var(--text-3)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={ClipboardList} title="No audit entries" description="All changes to this asset are automatically logged." />
      )}
    </SectionCard>
  )
}
