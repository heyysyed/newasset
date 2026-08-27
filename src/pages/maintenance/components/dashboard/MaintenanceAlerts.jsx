import React from 'react';
import { AlertTriangle, Clock, Activity, ArrowRight } from 'lucide-react';

export default function MaintenanceAlerts({ attentionQueue, isLoading }) {
  if (isLoading) {
    return (
      <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <h3 className="skeleton" style={{ width: 150, height: 24, marginBottom: 16 }}></h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }}></div>)}
        </div>
      </div>
    );
  }

  const items = (attentionQueue || []).slice(0, 8); // Max 8 items

  return (
    <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={20} color="var(--status-danger)" />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-0)' }}>
            Requires Attention
          </h3>
        </div>
        {items.length > 0 && (
          <span style={{ background: 'var(--status-danger)', color: 'white', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>
            {attentionQueue.length}
          </span>
        )}
      </div>

      <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
            <CheckCircle2 size={40} style={{ margin: '0 auto 16px', opacity: 0.5, color: 'var(--status-success)' }} />
            <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-1)' }}>All maintenance operations are currently within target.</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>No urgent items require attention.</p>
          </div>
        ) : (
          items.map((item, idx) => {
            const isBreached = item.slaStatus === 'BREACHED';
            const isCritical = item.priority === 'CRITICAL';
            
            return (
              <div 
                key={`${item.type}-${item.id}`} 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  background: 'var(--bg-1)',
                  borderRadius: 8,
                  borderLeft: `4px solid ${isBreached ? 'var(--status-danger)' : isCritical ? 'var(--status-warning)' : 'var(--accent)'}`,
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-2)', color: 'var(--text-2)' }}>
                      {item.type.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-0)' }}>{item.title}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>{item.assets?.name} ({item.assets?.sites?.name})</span>
                    {isBreached ? (
                      <span style={{ color: 'var(--status-danger)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> Breached SLA
                      </span>
                    ) : (
                      <span style={{ color: 'var(--status-warning)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> SLA At Risk
                      </span>
                    )}
                  </div>
                </div>
                
                <button className="btn-ghost" style={{ padding: 8, borderRadius: 8 }}>
                  <ArrowRight size={18} color="var(--text-2)" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {attentionQueue?.length > 8 && (
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <button className="btn-ghost" style={{ fontSize: '0.85rem', fontWeight: 500 }}>
            View all {attentionQueue.length} items
          </button>
        </div>
      )}
    </div>
  );
}

// Needed CheckCircle2 import inside the file since it's used in the empty state
import { CheckCircle2 } from 'lucide-react';


