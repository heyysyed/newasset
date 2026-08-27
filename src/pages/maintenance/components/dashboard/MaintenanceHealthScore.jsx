import React from 'react';
import { HeartPulse, CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';

export default function MaintenanceHealthScore({ kpis, slaBreachedCount, isLoading }) {
  if (isLoading) {
    return <div className="skeleton" style={{ height: 200, borderRadius: 12 }}></div>;
  }

  // Very basic rudimentary health score logic for Phase 2.2
  // We subtract points for overdue PMs, SLA breaches, and unapproved work
  let score = 100;
  
  const breaches = slaBreachedCount || 0;
  const overdue = kpis?.overduePMs || 0;
  const activeWOs = kpis?.activeWorkOrders || 0;
  
  score -= (breaches * 10);
  score -= (overdue * 5);
  
  // Guard against negative
  if (score < 0) score = 0;

  // Determine if we have enough data (if everything is 0, we might not have data)
  const hasData = (activeWOs + (kpis?.openTickets || 0)) > 0;

  let statusLabel = 'Healthy';
  let StatusIcon = CheckCircle2;
  let statusColor = 'var(--status-success)';

  if (score < 60) {
    statusLabel = 'Critical';
    StatusIcon = AlertOctagon;
    statusColor = 'var(--status-danger)';
  } else if (score < 85) {
    statusLabel = 'Needs Attention';
    StatusIcon = AlertTriangle;
    statusColor = 'var(--status-warning)';
  }

  return (
    <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <HeartPulse size={20} color="var(--accent)" />
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)' }}>
          Maintenance Health
        </h3>
      </div>

      {!hasData ? (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Health score unavailable.</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>More maintenance history is required.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <span style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1, color: statusColor }}>
              {score}
            </span>
            <span style={{ fontSize: '1rem', color: 'var(--text-3)', paddingBottom: 6 }}>/ 100</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: statusColor, fontWeight: 500 }}>
            <StatusIcon size={18} />
            <span>{statusLabel}</span>
          </div>

          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
            {breaches === 0 && overdue === 0 && (
              <div style={{ color: 'var(--status-success)' }}>+ Perfect SLA & PM compliance</div>
            )}
            {breaches > 0 && (
              <div style={{ color: 'var(--status-danger)' }}>- {breaches} SLA breach{breaches > 1 ? 'es' : ''}</div>
            )}
            {overdue > 0 && (
              <div style={{ color: 'var(--status-warning)' }}>- {overdue} overdue PM task{overdue > 1 ? 's' : ''}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


