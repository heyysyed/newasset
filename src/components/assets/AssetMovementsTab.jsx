import React from 'react'
import { History } from 'lucide-react'
import AssetTimeline from './AssetTimeline'
import { SectionCard, EmptyState } from '../../pages/AssetDetail'

export default function AssetMovementsTab({ asset, movements, maintenance, audit }) {
  if (!movements) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Timeline Visualization */}
      {movements.length > 0 && (
        <div style={{
          background: 'var(--bg-2)', border: '1.5px solid var(--border)', borderRadius: 18,
          padding: 24, boxShadow: 'var(--clay-shadow)', overflow: 'hidden', position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--cyan), var(--accent))' }} />
          <h4 style={{ textTransform: 'uppercase', margin: '0 0 20px', color: 'var(--text-2)', letterSpacing: '0.04em' }}>Movement Timeline</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
            {[...movements].reverse().map((m, idx, arr) => (
              <React.Fragment key={m.id}>
                <div style={{ textAlign: 'center', minWidth: 110, flexShrink: 0 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', margin: '0 auto 8px',
                    background: idx === arr.length - 1 ? 'linear-gradient(135deg, var(--accent), #6b96ff)' : 'var(--green)',
                    border: '3px solid var(--bg-2)', boxShadow: idx === arr.length - 1 ? '0 0 12px var(--accent-soft)' : '0 2px 6px rgba(0,185,107,0.2)',
                  }} />
                  <div style={{ color: 'var(--text-0)' }}>{m.to_location}</div>
                  <div style={{ color: 'var(--text-3)', }}>{new Date(m.moved_at).toLocaleDateString()}</div>
                </div>
                {idx < arr.length - 1 && <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, var(--green), var(--border))', minWidth: 30 }} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Lifecycle Timeline */}
      <SectionCard title="Lifecycle Timeline" icon={History} noPad accentColor="var(--accent)">
        <div style={{ padding: '0 20px' }}>
          <AssetTimeline asset={asset} movements={movements} maintenance={maintenance} audit={audit} />
        </div>
      </SectionCard>

      {/* Movement Table */}
      <SectionCard title={`Movement History (${movements.length})`} icon={History} noPad accentColor="var(--cyan)">
        {movements.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px', padding: 20 }}>
            {movements.map(m => (
              <div key={m.id} style={{ 
                background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '12px', 
                padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: 'var(--text-3)', textTransform: 'uppercase' }}>Date</span>
                    <span style={{ color: 'var(--text-1)', }}>{new Date(m.moved_at).toLocaleDateString()}</span>
                  </div>
                  <span className={`badge badge-${m.movement_type === 'check-out' ? 'repair' : m.movement_type === 'check-in' ? 'active' : 'onhire'}`}>
                    {m.movement_type}
                  </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--bg-2)', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: 'var(--text-3)', textTransform: 'uppercase' }}>From</span>
                    <span style={{ color: 'var(--text-2)' }}>{m.from_location || 'Initial'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: 'var(--text-3)', textTransform: 'uppercase' }}>To</span>
                    <span style={{ color: 'var(--text-0)', }}>{m.to_location}</span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-3)' }}>Moved By</span>
                    <span style={{ color: 'var(--text-1)', }}>{m.profiles?.full_name || 'System'}</span>
                  </div>
                  {m.notes && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-3)' }}>Notes</span>
                      <span style={{ color: 'var(--text-2)', fontStyle: 'italic', maxWidth: '60%', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={History} title="No movement history" description="Transfers between sites will appear here as a timeline." />
        )}
      </SectionCard>
    </div>
  )
}


