import React from 'react';
import { DollarSign, TrendingUp } from 'lucide-react';

export default function CostSnapshot({ costs, isLoading }) {
  if (isLoading) {
    return <div className="skeleton" style={{ height: 180, borderRadius: 12 }}></div>;
  }

  const hasData = costs && costs.completedJobs > 0;
  
  return (
    <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <DollarSign size={20} color="var(--status-success)" />
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-0)' }}>
          Cost Snapshot
        </h3>
      </div>

      {!hasData ? (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Maintenance cost analytics will appear once completed maintenance records are available.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>30-Day Spend</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1, color: 'var(--text-0)' }}>
                ${costs.currentPeriodSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--status-success)', fontSize: '0.85rem', fontWeight: 600, paddingBottom: 4 }}>
                <TrendingUp size={14} /> +0%
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Completed Jobs</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-1)' }}>{costs.completedJobs}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Avg Cost / Job</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-1)' }}>
                ${costs.averageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


