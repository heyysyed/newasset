import React from 'react';
import { Hammer, ArrowRight } from 'lucide-react';

export default function ActiveWorkOrdersTable({ workOrders, isLoading }) {
  if (isLoading) {
    return (
      <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <h3 className="skeleton" style={{ width: 200, height: 24, marginBottom: 16 }}></h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8 }}></div>)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Hammer size={20} color="var(--text-1)" />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-0)' }}>
            Active Work Orders
          </h3>
        </div>
        <button className="btn-ghost" style={{ fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
          View all <ArrowRight size={14} />
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {(!workOrders || workOrders.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-3)' }}>
            No active maintenance work orders.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>WO Title</th>
                <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Asset</th>
                <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Technician</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map(wo => (
                <tr key={wo.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px 24px', fontSize: '0.9rem', color: 'var(--text-0)', fontWeight: 500 }}>
                    {wo.title}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>WO-{wo.id.substring(0, 8).toUpperCase()}</div>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: '0.9rem', color: 'var(--text-1)' }}>
                    {wo.assets?.name || 'Unassigned'}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>{wo.assets?.sites?.name || ''}</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      padding: '4px 10px', 
                      borderRadius: 20, 
                      background: 'var(--bg-2)', 
                      color: 'var(--text-1)',
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}>
                      {wo.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: '0.9rem', color: 'var(--text-2)' }}>
                    {wo.profiles?.full_name || 'Unassigned'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


