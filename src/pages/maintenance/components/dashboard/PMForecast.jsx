import React from 'react';
import { CalendarClock } from 'lucide-react';

export default function PMForecast({ schedules, isLoading }) {
  if (isLoading) {
    return (
      <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <h3 className="skeleton" style={{ width: 150, height: 24, marginBottom: 16 }}></h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }}></div>)}
        </div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  
  let overdue = 0;
  let today = 0;
  let upcoming = 0;

  (schedules || []).forEach(s => {
    if (!s.next_due_date) return;
    const due = s.next_due_date.split('T')[0];
    if (due < todayStr) overdue++;
    else if (due === todayStr) today++;
    else upcoming++;
  });

  return (
    <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <CalendarClock size={20} color="var(--text-1)" />
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-0)' }}>
          PM Forecast
        </h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div style={{ background: 'var(--bg-1)', padding: 16, borderRadius: 8, textAlign: 'center', borderTop: '3px solid var(--status-danger)' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: overdue > 0 ? 'var(--status-danger)' : 'var(--text-2)' }}>{overdue}</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)', marginTop: 4 }}>OVERDUE</div>
        </div>
        
        <div style={{ background: 'var(--bg-1)', padding: 16, borderRadius: 8, textAlign: 'center', borderTop: '3px solid var(--status-warning)' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: today > 0 ? 'var(--status-warning)' : 'var(--text-2)' }}>{today}</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)', marginTop: 4 }}>DUE TODAY</div>
        </div>

        <div style={{ background: 'var(--bg-1)', padding: 16, borderRadius: 8, textAlign: 'center', borderTop: '3px solid var(--accent)' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: upcoming > 0 ? 'var(--accent)' : 'var(--text-2)' }}>{upcoming}</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)', marginTop: 4 }}>UPCOMING (30D)</div>
        </div>
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <button className="btn-primary" style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem' }}>View Schedule</button>
        <button className="btn-ghost" style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem', background: 'var(--bg-2)' }}>Generate Tasks</button>
      </div>
    </div>
  );
}


